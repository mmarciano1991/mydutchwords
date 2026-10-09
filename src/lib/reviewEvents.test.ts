import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewEventDraft } from "./learningEngine";

/* No localStorage in this environment — a minimal in-memory one. */
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});

const upsertMock = vi.fn();
vi.mock("./supabase", () => ({ supabase: { from: () => ({ upsert: upsertMock }) } }));

const { appendReviewEvent, flushReviewEvents, pendingReviewEvents } = await import("./reviewEvents");

function draft(wordId: string): ReviewEventDraft {
  return {
    wordId,
    sessionId: "00000000-0000-4000-8000-000000000001",
    timestamp: "2026-10-06T10:00:00.000Z",
    localDate: "2026-10-06",
    exerciseType: "multiple_choice",
    result: "correct",
    graded: true,
    responseTimeMs: 1500,
    stateBefore: "new",
    stateAfter: "learning",
    intervalBefore: 0,
    intervalAfter: 1,
  };
}

beforeEach(() => {
  store.clear();
  upsertMock.mockReset();
});

describe("review log outbox", () => {
  it("appends every event with its own id and the user who answered", () => {
    const a = appendReviewEvent(draft("a"), "u1");
    const b = appendReviewEvent(draft("b"), "u1");
    expect(a.id).not.toBe(b.id);
    expect(pendingReviewEvents().map((e) => [e.wordId, e.userId])).toEqual([
      ["a", "u1"],
      ["b", "u1"],
    ]);
  });

  it("uploads only the signed-in user's events, ignoring duplicates, and clears them", async () => {
    appendReviewEvent(draft("a"), "u1");
    appendReviewEvent(draft("b"), "u2");
    upsertMock.mockResolvedValueOnce({ error: null });
    expect(await flushReviewEvents("u1")).toBe(true);
    const [rows, options] = upsertMock.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "u1", word_id: "a", result: "correct", graded: true, local_date: "2026-10-06" });
    expect(options).toEqual({ onConflict: "id", ignoreDuplicates: true });
    expect(pendingReviewEvents().map((e) => e.userId)).toEqual(["u2"]);
  });

  it("keeps events when the upload fails, so a retry sends the same ids", async () => {
    const e = appendReviewEvent(draft("a"), "u1");
    upsertMock.mockResolvedValueOnce({ error: new Error("offline") });
    expect(await flushReviewEvents("u1")).toBe(false);
    expect(pendingReviewEvents().map((p) => p.id)).toEqual([e.id]);
    upsertMock.mockResolvedValueOnce({ error: null });
    expect(await flushReviewEvents("u1")).toBe(true);
    expect(upsertMock.mock.calls[1][0][0].id).toBe(e.id);
  });

  it("keeps an event appended while an upload is in flight", async () => {
    appendReviewEvent(draft("a"), "u1");
    let release!: (v: { error: null }) => void;
    upsertMock.mockReturnValueOnce(new Promise((r) => (release = r)));
    const flushing = flushReviewEvents("u1");
    appendReviewEvent(draft("late"), "u1");
    release({ error: null });
    await flushing;
    expect(pendingReviewEvents().map((e) => e.wordId)).toEqual(["late"]);
  });
});

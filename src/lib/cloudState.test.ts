import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppState } from "./cloudState";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./types";
import { newWord } from "./learningEngine";

const maybeSingleMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      upsert: upsertMock,
    }),
  },
}));

// Imported after the mock so cloudState.ts picks up the mocked client.
const { mergeState, fetchRemoteState, pushState } = await import("./cloudState");

function deckItem(id: string, over: Partial<DeckItem> = {}): DeckItem {
  return { ...newWord(id, new Date(0)), dateAdded: 1000, ...over };
}
const result = (entryId: string, timestamp: number, grade: PracticeResult["grade"] = "know"): PracticeResult => ({
  entryId,
  timestamp,
  grade,
});
const entry = (id: string): DictionaryEntry => ({
  id,
  dutch: id,
  english: id,
  gender: "none",
  example: "",
  exampleEn: "",
  senses: [{ english: id, example: "", exampleEn: "", gender: "none" }],
});
const state = (over: Partial<AppState> = {}): AppState => ({
  deck: [],
  results: [],
  customWords: [],
  run: null,
  ...over,
});

describe("mergeState", () => {
  it("unions deck words present on only one side", () => {
    const merged = mergeState(state({ deck: [deckItem("huis")] }), state({ deck: [deckItem("boek")] }));
    expect(merged.deck.map((d) => d.id).sort()).toEqual(["boek", "huis"]);
  });

  it("keeps the copy graded most recently — its state is the later one", () => {
    const older = deckItem("huis", { reps: 5, successfulReviewDays: 5, lastReviewedAt: new Date(100_000).toISOString() });
    const newer = deckItem("huis", { reps: 0, lapses: 1, lastReviewedAt: new Date(500_000).toISOString() });
    const merged = mergeState(state({ deck: [older] }), state({ deck: [newer] }));
    expect(merged.deck).toHaveLength(1);
    expect(merged.deck[0].lastReviewedAt).toBe(new Date(500_000).toISOString());
  });

  it("breaks recency ties by the copy with more evidence", () => {
    const at = new Date(100_000).toISOString();
    const thin = deckItem("huis", { successfulReviewDays: 1, lastReviewedAt: at });
    const rich = deckItem("huis", { successfulReviewDays: 4, lastReviewedAt: at });
    expect(mergeState(state({ deck: [thin] }), state({ deck: [rich] })).deck[0].successfulReviewDays).toBe(4);
  });

  it("is order-independent for deck conflicts", () => {
    const a = deckItem("huis", { reps: 1, lastReviewedAt: new Date(100_000).toISOString() });
    const b = deckItem("huis", { reps: 9, lastReviewedAt: new Date(900_000).toISOString() });
    const ab = mergeState(state({ deck: [a] }), state({ deck: [b] }));
    const ba = mergeState(state({ deck: [b] }), state({ deck: [a] }));
    expect(ab.deck[0].reps).toBe(9);
    expect(ba.deck[0].reps).toBe(9);
  });

  it("migrates a copy from an older client before merging it", () => {
    const legacy = {
      id: "huis",
      dateAdded: 1000,
      level: 2,
      interval: 3,
      reps: 2,
      dueDate: new Date(0).toISOString(),
      lapses: 0,
      state: "learning",
      lastReviewedAt: new Date(50_000).toISOString(),
    } as unknown as DeckItem;
    const merged = mergeState(state({ deck: [legacy] }), state({ results: [result("huis", 50_000)] }));
    expect(merged.deck[0]).toMatchObject({ engineVersion: 2, state: "learning", interval: 3 });
  });

  it("unions results and dedupes identical events", () => {
    const shared = result("huis", 5);
    const merged = mergeState(
      state({ results: [shared, result("huis", 10)] }),
      state({ results: [shared, result("boek", 7)] })
    );
    expect(merged.results).toHaveLength(3);
    // sorted by timestamp
    expect(merged.results.map((r) => r.timestamp)).toEqual([5, 7, 10]);
  });

  it("keeps distinct grades at the same timestamp", () => {
    const merged = mergeState(
      state({ results: [result("huis", 5, "know")] }),
      state({ results: [result("huis", 5, "dontKnow")] })
    );
    expect(merged.results).toHaveLength(2);
  });

  it("unions custom words by id without duplicating", () => {
    const merged = mergeState(
      state({ customWords: [entry("fiets")] }),
      state({ customWords: [entry("fiets"), entry("tram")] })
    );
    expect(merged.customWords.map((e) => e.id).sort()).toEqual(["fiets", "tram"]);
  });

  // ── The run: one sitting's record. Not unioned — blending two devices'
  //    answers would invent a session that never happened. ──
  it("keeps the newer day's run, so yesterday's result is never shown today", () => {
    const yesterday = { date: "2024-05-31", wordIds: ["a"], answers: { a: "know" as const } };
    const today = { date: "2024-06-01", wordIds: ["b"], answers: {} };
    expect(mergeState(state({ run: yesterday }), state({ run: today })).run).toEqual(today);
    expect(mergeState(state({ run: today }), state({ run: yesterday })).run).toEqual(today);
  });

  it("keeps the same-day run that got further", () => {
    const barely = { date: "2024-06-01", wordIds: ["a", "b"], answers: { a: "know" as const } };
    const finished = {
      date: "2024-06-01",
      wordIds: ["a", "b"],
      answers: { a: "know" as const, b: "dontKnow" as const },
    };
    expect(mergeState(state({ run: barely }), state({ run: finished })).run).toEqual(finished);
    expect(mergeState(state({ run: finished }), state({ run: barely })).run).toEqual(finished);
  });

  it("takes whichever run exists when only one device has practised", () => {
    const run = { date: "2024-06-01", wordIds: ["a"], answers: {} };
    expect(mergeState(state(), state({ run })).run).toEqual(run);
    expect(mergeState(state({ run }), state()).run).toEqual(run);
  });

  it("is null when neither device has practised", () => {
    expect(mergeState(state(), state()).run).toBeNull();
  });

  it("returns deck newest-first", () => {
    const merged = mergeState(
      state({ deck: [deckItem("a", { dateAdded: 1 })] }),
      state({ deck: [deckItem("b", { dateAdded: 9 })] })
    );
    expect(merged.deck.map((d) => d.id)).toEqual(["b", "a"]);
  });
});

// fetchRemoteState must let callers tell "the fetch failed" apart from "the
// fetch succeeded and there's genuinely nothing saved" — conflating the two
// is what let a transient error wipe real cloud progress (see useCloudSync).
describe("fetchRemoteState", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
  });

  it("reports ok:true with a null state for a brand-new user", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchRemoteState("user-1");
    expect(result).toEqual({ ok: true, state: null });
  });

  it("reports ok:true with the saved state when a row exists", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { deck: [deckItem("huis")], results: [], custom_words: [] },
      error: null,
    });
    const result = await fetchRemoteState("user-1");
    expect(result.ok).toBe(true);
    expect(result.ok && result.state?.deck.map((d) => d.id)).toEqual(["huis"]);
  });

  it("reports ok:false (not ok:true, state:null) on a query error", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: new Error("network down") });
    const result = await fetchRemoteState("user-1");
    expect(result).toEqual({ ok: false });
  });

  it("reports ok:false (not ok:true, state:null) when the request throws", async () => {
    maybeSingleMock.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchRemoteState("user-1");
    expect(result).toEqual({ ok: false });
  });
});

describe("pushState", () => {
  beforeEach(() => {
    upsertMock.mockReset();
  });

  it("resolves true on a clean upsert", async () => {
    upsertMock.mockResolvedValueOnce({ error: null });
    const ok = await pushState("user-1", state());
    expect(ok).toBe(true);
  });

  it("resolves false (never throws) on an upsert error", async () => {
    upsertMock.mockResolvedValueOnce({ error: new Error("network down") });
    const ok = await pushState("user-1", state());
    expect(ok).toBe(false);
  });
});

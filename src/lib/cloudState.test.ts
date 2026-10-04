import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppState } from "./cloudState";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./types";

const maybeSingleMock = vi.fn();
const upsertMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      upsert: upsertMock,
    }),
    rpc: rpcMock,
  },
}));

// Imported after the mock so cloudState.ts picks up the mocked client.
const { mergeState, fetchRemoteState, pushState } = await import("./cloudState");

function deckItem(id: string, over: Partial<DeckItem> = {}): DeckItem {
  return {
    id,
    dateAdded: 1000,
    level: 0,
    interval: 0,
    reps: 0,
    dueDate: new Date(0).toISOString(),
    lapses: 0,
    state: "new",
    lastReviewedAt: null,
    ...over,
  };
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
  dailySet: null,
  run: null,
  ...over,
});

describe("mergeState", () => {
  it("unions deck words present on only one side", () => {
    const merged = mergeState(state({ deck: [deckItem("huis")] }), state({ deck: [deckItem("boek")] }));
    expect(merged.deck.map((d) => d.id).sort()).toEqual(["boek", "huis"]);
  });

  it("keeps the more-practised copy of a conflicting word", () => {
    const local = deckItem("huis", { reps: 1, level: 1 });
    const remote = deckItem("huis", { reps: 5, level: 4, lapses: 1 });
    const merged = mergeState(state({ deck: [local] }), state({ deck: [remote] }));
    expect(merged.deck).toHaveLength(1);
    expect(merged.deck[0].reps).toBe(5);
    expect(merged.deck[0].level).toBe(4);
  });

  it("breaks progress ties by most recent review", () => {
    const older = deckItem("huis", { reps: 2, lastReviewedAt: new Date(100_000).toISOString() });
    const newer = deckItem("huis", { reps: 2, lastReviewedAt: new Date(500_000).toISOString() });
    const merged = mergeState(state({ deck: [older] }), state({ deck: [newer] }));
    expect(merged.deck[0].lastReviewedAt).toBe(new Date(500_000).toISOString());
  });

  it("is order-independent for deck conflicts", () => {
    const a = deckItem("huis", { reps: 1 });
    const b = deckItem("huis", { reps: 9 });
    const ab = mergeState(state({ deck: [a] }), state({ deck: [b] }));
    const ba = mergeState(state({ deck: [b] }), state({ deck: [a] }));
    expect(ab.deck[0].reps).toBe(9);
    expect(ba.deck[0].reps).toBe(9);
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

  // ── The day's set. Only one can survive a merge (it is a single draw, not
  //    a collection), so the rules have to protect answers already given. ──
  it("keeps the newer day's set — yesterday's draw is spent", () => {
    const yesterday = { date: "2024-05-31", wordIds: ["a", "b"] };
    const today = { date: "2024-06-01", wordIds: ["c", "d"] };
    expect(mergeState(state({ dailySet: yesterday }), state({ dailySet: today })).dailySet)
      .toEqual(today);
    expect(mergeState(state({ dailySet: today }), state({ dailySet: yesterday })).dailySet)
      .toEqual(today);
  });

  it("takes whichever set exists when only one device has drawn", () => {
    const set = { date: "2024-06-01", wordIds: ["a"] };
    expect(mergeState(state(), state({ dailySet: set })).dailySet).toEqual(set);
    expect(mergeState(state({ dailySet: set }), state()).dailySet).toEqual(set);
  });

  it("is null when neither device has drawn", () => {
    expect(mergeState(state(), state()).dailySet).toBeNull();
  });

  it("never lets a device that drew nothing overwrite the real set", () => {
    // A fresh login draws an empty set locally (the deck hasn't arrived yet)
    // before the pull lands. That must not clobber the day already in flight.
    const real = { date: "2024-06-01", wordIds: ["a", "b"] };
    const empty = { date: "2024-06-01", wordIds: [] };
    expect(mergeState(state({ dailySet: empty }), state({ dailySet: real })).dailySet)
      .toEqual(real);
    expect(mergeState(state({ dailySet: real }), state({ dailySet: empty })).dailySet)
      .toEqual(real);
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
    expect(result).toEqual({ ok: true, state: null, version: 0 });
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
  const legacy = { version: null, serverResults: new Set<string>() };

  beforeEach(() => {
    upsertMock.mockReset();
    rpcMock.mockReset();
  });

  it("upserts the whole snapshot on a pre-versioning server", async () => {
    upsertMock.mockResolvedValueOnce({ error: null });
    expect(await pushState("user-1", state(), legacy)).toEqual({ status: "ok", version: null });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("reports an error (never throws) on an upsert error", async () => {
    upsertMock.mockResolvedValueOnce({ error: new Error("network down") });
    expect(await pushState("user-1", state(), legacy)).toEqual({ status: "error" });
  });

  it("sends only the results the server doesn't have yet", async () => {
    rpcMock.mockResolvedValueOnce({ data: { status: "ok", version: 4 }, error: null });
    const old = result("huis", 1);
    const fresh = result("boek", 2);
    const pushed = await pushState("user-1", state({ results: [old, fresh] }), {
      version: 3,
      serverResults: new Set(["huis|1|know"]),
    });
    expect(pushed).toEqual({ status: "ok", version: 4 });
    const [fn, args] = rpcMock.mock.calls[0];
    expect(fn).toBe("sync_user_state");
    expect(args.p_expected_version).toBe(3);
    expect(args.p_new_results).toEqual([fresh]);
  });

  it("hands back the newer row on a version conflict", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { status: "conflict", row: { deck: [deckItem("kat")], results: [], custom_words: [], version: 7 } },
      error: null,
    });
    const pushed = await pushState("user-1", state(), { version: 3, serverResults: new Set() });
    expect(pushed.status).toBe("conflict");
    expect(pushed.status === "conflict" && pushed.version).toBe(7);
    expect(pushed.status === "conflict" && pushed.remote?.deck.map((d) => d.id)).toEqual(["kat"]);
  });

  it("falls back to an upsert when the sync function isn't deployed", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "not found" } });
    upsertMock.mockResolvedValue({ error: null });
    expect(await pushState("user-1", state(), { version: 0, serverResults: new Set() })).toEqual({
      status: "ok",
      version: null,
    });
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});

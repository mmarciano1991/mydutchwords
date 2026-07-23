import { describe, expect, it } from "vitest";
import { mergeState, type AppState } from "./cloudState";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./types";

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
const entry = (id: string): DictionaryEntry => ({ id, dutch: id, english: id, gender: null, example: "", exampleEn: "" });
const state = (over: Partial<AppState> = {}): AppState => ({ deck: [], results: [], customWords: [], ...over });

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

  it("returns deck newest-first", () => {
    const merged = mergeState(
      state({ deck: [deckItem("a", { dateAdded: 1 })] }),
      state({ deck: [deckItem("b", { dateAdded: 9 })] })
    );
    expect(merged.deck.map((d) => d.id)).toEqual(["b", "a"]);
  });
});

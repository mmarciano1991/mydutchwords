import { describe, expect, it } from "vitest";
import {
  advanceQueue,
  buildChoices,
  checkTyped,
  initialQueue,
  pickExercise,
  synonymsOf,
  type QueueItem,
} from "./exercises";
import type { DictionaryEntry, Gender } from "./types";
import type { Word } from "./learningEngine";

function entry(dutch: string, english: string, gender: Gender = "none"): DictionaryEntry {
  const sense = { english, example: "", exampleEn: "", gender };
  return { id: dutch, dutch, english, gender, example: "", exampleEn: "", senses: [sense] };
}

function word(level: number, state: Word["state"] = level === 0 ? "new" : "learning"): Word {
  return { id: "x", level, interval: 1, reps: 0, dueDate: "", lapses: 0, state, lastReviewedAt: null };
}

/** Deterministic stand-in for Math.random. */
function seeded(seed = 1): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

describe("advanceQueue", () => {
  const ids = (q: QueueItem[]) => q.map((i) => i.id);

  it("drops a word answered correctly", () => {
    expect(ids(advanceQueue(initialQueue(["a", "b", "c"]), true, "choice"))).toEqual(["b", "c"]);
  });

  it("puts a miss back after other words, not straight away", () => {
    const q = advanceQueue(initialQueue(["a", "b", "c", "d", "e"]), false, "choice");
    expect(ids(q)).toEqual(["b", "c", "d", "a", "e"]);
    expect(q[3]).toEqual({ id: "a", attempts: 1, lastKind: "choice" });
  });

  it("puts a miss last when fewer words are left than the gap", () => {
    expect(ids(advanceQueue(initialQueue(["a", "b"]), false, "typing"))).toEqual(["b", "a"]);
  });

  it("keeps asking the last word until it's right", () => {
    const q = advanceQueue(initialQueue(["a"]), false, "typing");
    expect(ids(q)).toEqual(["a"]);
    expect(advanceQueue(q, true, "choice")).toEqual([]);
  });

  it("plays out the spec's example: A wrong, B, C right, D wrong, A again", () => {
    let q = initialQueue(["A", "B", "C", "D", "E"]);
    const asked: string[] = [];
    const wrong = new Set(["A", "D"]);
    while (q.length > 0) {
      const head = q[0];
      asked.push(head.id);
      q = advanceQueue(q, head.attempts > 0 || !wrong.has(head.id), "choice");
    }
    expect(asked).toEqual(["A", "B", "C", "D", "A", "E", "D"]);
  });
});

describe("pickExercise", () => {
  const first = { id: "x", attempts: 0 };

  it("asks a new word as a choice", () => {
    expect(pickExercise(word(0), first, true)).toBe("choice");
  });

  it("types a word on its way up, and flashcards a well-known one", () => {
    expect(pickExercise(word(1), first, true)).toBe("typing");
    expect(pickExercise(word(2), first, true)).toBe("typing");
    expect(pickExercise(word(4), first, true)).toBe("flashcard");
  });

  it("steps sideways on a retry", () => {
    expect(pickExercise(word(0), { id: "x", attempts: 1, lastKind: "choice" }, true)).toBe("typing");
    expect(pickExercise(word(2), { id: "x", attempts: 1, lastKind: "typing" }, true)).toBe("choice");
    expect(pickExercise(word(5), { id: "x", attempts: 1, lastKind: "flashcard" }, true)).toBe("choice");
  });

  it("falls back when no options can be built", () => {
    expect(pickExercise(word(0), first, false)).toBe("flashcard");
    expect(pickExercise(word(2), { id: "x", attempts: 1, lastKind: "typing" }, false)).toBe("typing");
  });
});

describe("buildChoices", () => {
  const meet = entry("ontmoeten", "to meet");
  const pool = [
    meet,
    entry("volgen", "to follow"),
    entry("vertrekken", "to leave"),
    entry("corrigeren", "to correct"),
    entry("tegenwoordig", "nowadays"),
    entry("huis", "house", "het"),
  ];

  it("offers the answer and three distractors, once each", () => {
    const options = buildChoices(meet, pool, seeded())!;
    expect(options).toHaveLength(4);
    expect(options).toContain("ontmoeten");
    expect(new Set(options).size).toBe(4);
  });

  it("prefers distractors of the same kind of word", () => {
    const options = buildChoices(meet, pool, seeded())!;
    expect(options.sort()).toEqual(["corrigeren", "ontmoeten", "vertrekken", "volgen"]);
  });

  it("never offers a second word with the same meaning", () => {
    const withSynonym = [...pool, entry("treffen", "to meet")];
    for (let s = 1; s < 20; s++) {
      expect(buildChoices(meet, withSynonym, seeded(s))).not.toContain("treffen");
    }
  });

  it("returns null when the pool is too small", () => {
    expect(buildChoices(meet, pool.slice(0, 3))).toBeNull();
  });
});

describe("checkTyped", () => {
  it("accepts the word regardless of case, spacing, accents and article", () => {
    expect(checkTyped("  Ontmoeten ", "ontmoeten")).toBe("correct");
    expect(checkTyped("cafe", "café")).toBe("correct");
    expect(checkTyped("het huis", "huis")).toBe("correct");
    expect(checkTyped("de huis", "huis")).toBe("correct");
    expect(checkTyped("in loondienst", "in loondienst")).toBe("correct");
  });

  it("forgives one slip in a longer word, and calls it a typo", () => {
    expect(checkTyped("ontmoten", "ontmoeten")).toBe("typo");
    expect(checkTyped("ontmeoten", "ontmoeten")).toBe("typo");
    expect(checkTyped("ontmoetenn", "ontmoeten")).toBe("typo");
  });

  it("is strict on short words and on real mistakes", () => {
    expect(checkTyped("hues", "huis")).toBe("wrong");
    expect(checkTyped("volgen", "ontmoeten")).toBe("wrong");
    expect(checkTyped("   ", "ontmoeten")).toBe("wrong");
  });

  it("accepts a synonym from the deck", () => {
    const meet = entry("ontmoeten", "to meet");
    const pool = [meet, entry("treffen", "to meet"), entry("volgen", "to follow")];
    expect(checkTyped("treffen", "ontmoeten", synonymsOf(meet, pool))).toBe("correct");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDailySet,
  DAILY_SET_SIZE,
  dayKey,
  pruneRun,
  recordAnswer,
  recordCleared,
  runAnswerCount,
  runProgress,
  startRun,
  type PracticeRun,
} from "./dailySet";
import type { Grade, Word } from "./learningEngine";

/** Local noon on the given local calendar day — safely inside the day in
 *  every timezone, unlike a UTC midnight that lands on the day before or
 *  after depending on the offset. */
function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

const NOW = localNoon(2024, 6, 1);
const TODAY = dayKey(NOW);

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "w1",
    level: 0,
    interval: 0,
    reps: 0,
    dueDate: NOW.toISOString(),
    lapses: 0,
    state: "new",
    lastReviewedAt: null,
    ...overrides,
  };
}

/** `count` brand-new words, ids w0…w{count-1}. */
function newWords(count: number): Word[] {
  return Array.from({ length: count }, (_, i) => makeWord({ id: `w${i}` }));
}

/** A run over `ids` with the listed answers already recorded. */
function runWith(ids: string[], answers: Record<string, Grade> = {}): PracticeRun {
  return Object.entries(answers).reduce(
    (run, [id, grade]) => recordAnswer(run, id, grade),
    startRun(ids, NOW)
  );
}

describe("dayKey", () => {
  it("is a zero-padded local calendar date", () => {
    expect(dayKey(localNoon(2024, 3, 7))).toBe("2024-03-07");
    expect(dayKey(localNoon(2024, 12, 25))).toBe("2024-12-25");
  });

  it("uses the local day, not UTC — a late evening still belongs to its own day", () => {
    const lateEvening = new Date(2024, 5, 1, 23, 30, 0, 0);
    expect(dayKey(lateEvening)).toBe("2024-06-01");
  });
});

describe("buildDailySet", () => {
  it("draws sixteen words", () => {
    const set = buildDailySet(newWords(50), NOW);
    expect(set.wordIds).toHaveLength(DAILY_SET_SIZE);
    expect(set.date).toBe(TODAY);
  });

  it("draws every word when the deck is smaller than a full set", () => {
    const set = buildDailySet(newWords(5), NOW);
    expect(set.wordIds).toEqual(["w0", "w1", "w2", "w3", "w4"]);
  });

  it("is empty only when the deck is", () => {
    expect(buildDailySet([], NOW).wordIds).toEqual([]);
  });

  // Regression: a returning user whose reviews all fall next week was handed
  // an empty set, so the day had no result to reach — the dashboard sat on
  // the caught-up card and its ungraded warm-up for ever.
  it("still draws a full set when nothing is due and nothing is new", () => {
    const scheduled = Array.from({ length: 30 }, (_, i) =>
      makeWord({
        id: `s${i}`,
        state: "learning",
        level: 2,
        dueDate: localNoon(2024, 6, 20 + (i % 10)).toISOString(),
      })
    );
    expect(buildDailySet(scheduled, NOW).wordIds).toHaveLength(DAILY_SET_SIZE);
  });

  it("tops the set up with whatever comes back soonest", () => {
    const soon = makeWord({
      id: "soon",
      state: "learning",
      level: 2,
      dueDate: localNoon(2024, 6, 3).toISOString(),
    });
    const later = makeWord({
      id: "later",
      state: "learning",
      level: 2,
      dueDate: localNoon(2024, 7, 30).toISOString(),
    });
    expect(buildDailySet([later, soon], NOW).wordIds).toEqual(["soon", "later"]);
  });

  it("keeps due reviews and new words ahead of the top-up", () => {
    const due = makeWord({
      id: "due",
      state: "learning",
      level: 1,
      dueDate: localNoon(2024, 5, 30).toISOString(),
    });
    const ahead = makeWord({
      id: "ahead",
      state: "learning",
      level: 2,
      dueDate: localNoon(2024, 6, 5).toISOString(),
    });
    expect(buildDailySet([ahead, due, makeWord({ id: "fresh" })], NOW).wordIds).toEqual([
      "due",
      "fresh",
      "ahead",
    ]);
  });

  it("never repeats a word within a set", () => {
    const set = buildDailySet(newWords(30), NOW);
    expect(new Set(set.wordIds).size).toBe(set.wordIds.length);
  });

  it("leads with due reviews, then tops up with new words", () => {
    const due = makeWord({
      id: "due",
      state: "learning",
      level: 1,
      dueDate: localNoon(2024, 5, 30).toISOString(),
    });
    const set = buildDailySet([...newWords(20), due], NOW);
    expect(set.wordIds[0]).toBe("due");
    expect(set.wordIds).toHaveLength(DAILY_SET_SIZE);
  });

  it("puts leeches first among the due reviews", () => {
    const plain = makeWord({
      id: "plain",
      state: "learning",
      level: 2,
      lapses: 0,
      dueDate: localNoon(2024, 5, 28).toISOString(),
    });
    const leech = makeWord({
      id: "leech",
      state: "learning",
      level: 1,
      lapses: 5,
      dueDate: localNoon(2024, 5, 31).toISOString(),
    });
    expect(buildDailySet([plain, leech], NOW).wordIds).toEqual(["leech", "plain"]);
  });
});

describe("runProgress", () => {
  it("reports nothing when no run has been started", () => {
    const p = runProgress(null, TODAY);
    expect(p.status).toBe("ready");
    expect(p.total).toBe(0);
  });

  // A stale run must never be read as today's result — that is how a
  // yesterday's score would end up on today's card.
  it("ignores a run from an earlier day", () => {
    const yesterday: PracticeRun = { date: "2024-05-31", wordIds: ["a"], answers: { a: "know" } };
    expect(runProgress(yesterday, TODAY).status).toBe("ready");
    expect(runProgress(yesterday, TODAY).total).toBe(0);
  });

  it("is ready before the first answer", () => {
    const p = runProgress(runWith(["a", "b", "c"]), TODAY);
    expect(p.status).toBe("ready");
    expect(p.remaining).toEqual(["a", "b", "c"]);
  });

  it("is in progress part-way through, and reports what is left in run order", () => {
    const p = runProgress(runWith(["a", "b", "c"], { a: "know" }), TODAY);
    expect(p.status).toBe("progress");
    expect(p.answered).toBe(1);
    expect(p.remaining).toEqual(["b", "c"]);
  });

  // Getting one wrong still counts as answered — a miss is a result, not a
  // gap. Without this the run could never finish on an all-wrong sitting.
  it("counts a wrong answer as answered, not as remaining", () => {
    const p = runProgress(runWith(["a", "b"], { a: "dontKnow" }), TODAY);
    expect(p.status).toBe("progress");
    expect(p.answered).toBe(1);
    expect(p.remaining).toEqual(["b"]);
  });

  it("is done once every word has an answer, and splits the result", () => {
    const p = runProgress(
      runWith(["a", "b", "c"], { a: "know", b: "dontKnow", c: "know" }),
      TODAY
    );
    expect(p.status).toBe("done");
    expect(p.remaining).toEqual([]);
    expect(p.knownIds).toEqual(["a", "c"]);
    expect(p.learningIds).toEqual(["b"]);
  });

  it("classifies an all-wrong sitting as nothing known", () => {
    const p = runProgress(runWith(["a", "b"], { a: "dontKnow", b: "dontKnow" }), TODAY);
    expect(p.status).toBe("done");
    expect(p.knownIds).toEqual([]);
    expect(p.learningIds).toEqual(["a", "b"]);
  });

  it("classifies a perfect sitting as nothing left to learn", () => {
    const p = runProgress(runWith(["a", "b"], { a: "know", b: "know" }), TODAY);
    expect(p.status).toBe("done");
    expect(p.learningIds).toEqual([]);
  });
});

describe("startRun", () => {
  // The bug this guards: a re-drill that inherited the previous sitting's
  // answers would report as finished before a single card was shown.
  it("starts with nothing answered, whatever came before", () => {
    const finished = runWith(["a", "b"], { a: "know", b: "know" });
    const fresh = startRun(finished.wordIds, NOW);
    expect(fresh.answers).toEqual({});
    expect(runProgress(fresh, TODAY).status).toBe("ready");
  });

  it("copies the word list rather than aliasing it", () => {
    const ids = ["a", "b"];
    const run = startRun(ids, NOW);
    ids.push("c");
    expect(run.wordIds).toEqual(["a", "b"]);
  });
});

describe("recordAnswer", () => {
  it("records an answer without mutating the run", () => {
    const before = startRun(["a"], NOW);
    const after = recordAnswer(before, "a", "know");
    expect(before.answers).toEqual({});
    expect(after.answers).toEqual({ a: "know" });
  });

  it("lets a later answer in the same run replace an earlier one", () => {
    const run = runWith(["a"], { a: "know" });
    expect(recordAnswer(run, "a", "dontKnow").answers).toEqual({ a: "dontKnow" });
  });

  it("ignores a word that isn't in the run", () => {
    const run = startRun(["a"], NOW);
    expect(recordAnswer(run, "z", "know")).toBe(run);
  });
});

describe("pruneRun", () => {
  it("is a no-op when every word is still in the deck", () => {
    const run = runWith(["a", "b"], { a: "know" });
    expect(pruneRun(run, () => true)).toBe(run);
  });

  // Otherwise a word deleted mid-sitting stays "to go" with no card behind
  // it, and the run can never reach done.
  it("drops deleted words and their answers", () => {
    const run = runWith(["a", "b"], { a: "know", b: "dontKnow" });
    const pruned = pruneRun(run, (id) => id !== "b");
    expect(pruned.wordIds).toEqual(["a"]);
    expect(pruned.answers).toEqual({ a: "know" });
    expect(runProgress(pruned, TODAY).status).toBe("done");
  });
});

describe("runAnswerCount", () => {
  it("counts only answers for words the run covers", () => {
    expect(runAnswerCount(runWith(["a", "b"], { a: "know" }))).toBe(1);
  });
});

describe("cleared words — a miss is only done once it's right", () => {
  const now = new Date(2026, 9, 4, 12);
  const today = dayKey(now);

  it("reports a missed word as outstanding until it is cleared", () => {
    let run = startRun(["a", "b"], now);
    run = recordAnswer(run, "a", "dontKnow");
    run = recordAnswer(run, "b", "know");
    run = recordCleared(run, "b");
    expect(runProgress(run, today).outstanding).toEqual(["a"]);
    run = recordCleared(run, "a");
    const p = runProgress(run, today);
    expect(p.outstanding).toEqual([]);
    // Still reported as missed on the first try.
    expect(p.learningIds).toEqual(["a"]);
  });

  it("tracks nothing outstanding for an untracked run (a re-drill) or an old one", () => {
    let run = startRun(["a"], now, false);
    run = recordAnswer(run, "a", "dontKnow");
    expect(runProgress(run, today).outstanding).toEqual([]);
    expect(recordCleared(run, "a")).toBe(run);
  });

  it("ignores ids outside the run, and prunes cleared words with the deck", () => {
    let run = startRun(["a", "b"], now);
    expect(recordCleared(run, "z")).toBe(run);
    run = recordCleared(run, "a");
    expect(pruneRun(run, (id) => id !== "a").cleared).toEqual([]);
  });
});

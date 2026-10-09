import { describe, expect, it } from "vitest";
import {
  dayKey,
  deferWords,
  isFullSession,
  priorItems,
  pruneRun,
  recordAnswer,
  remainingSteps,
  runAnswerCount,
  runAnswerFor,
  runProgress,
  startRun,
  type PracticeRun,
  type RunAnswer,
} from "./dailySet";
import type { PlannedStep } from "./learningEngine";

/** Local noon on the given local calendar day — safely inside the day in
 *  every timezone, unlike a UTC midnight that lands on the day before or
 *  after depending on the offset. */
function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

const NOW = localNoon(2024, 6, 1);
const TODAY = dayKey(NOW);

/** A run over `ids` with the listed answers already recorded. */
function runWith(ids: string[], answers: Record<string, RunAnswer> = {}): PracticeRun {
  return Object.entries(answers).reduce((run, [id, a]) => recordAnswer(run, id, a, NOW), startRun(ids, NOW));
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

describe("runProgress", () => {
  it("reports nothing when no run has been started", () => {
    const p = runProgress(null, TODAY);
    expect(p.status).toBe("ready");
    expect(p.total).toBe(0);
  });

  // A stale run must never be read as today's result.
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

  // A miss is a result, not a gap. Without this a session could never
  // finish on an all-wrong sitting.
  it("counts a wrong answer, a skip and a flashcard fallback as answered", () => {
    const p = runProgress(runWith(["a", "b", "c", "d"], { a: "dontKnow", b: "skipped", c: "seen" }), TODAY);
    expect(p.answered).toBe(3);
    expect(p.remaining).toEqual(["d"]);
  });

  it("is done once every word has an answer, and splits the result", () => {
    const p = runProgress(runWith(["a", "b", "c"], { a: "know", b: "dontKnow", c: "know" }), TODAY);
    expect(p.status).toBe("done");
    expect(p.knownIds).toEqual(["a", "c"]);
    expect(p.learningIds).toEqual(["b"]);
  });
});

describe("full sessions", () => {
  it("is full once every word is answered, right or wrong", () => {
    let run = startRun(["a", "b"], NOW);
    run = recordAnswer(run, "a", "dontKnow", NOW);
    expect(isFullSession(run)).toBe(false);
    run = recordAnswer(run, "b", "know", NOW);
    expect(isFullSession(run)).toBe(true);
    expect(run.completedAt).toBe(NOW.getTime());
  });

  it("an incomplete session is not full", () => {
    expect(isFullSession(runWith(["a", "b"], { a: "know" }))).toBe(false);
  });

  it("a practice round never counts as a full session", () => {
    let run = startRun(["a"], NOW, { kind: "practice" });
    run = recordAnswer(run, "a", "know", NOW);
    expect(isFullSession(run)).toBe(false);
  });

  it("a session crossing midnight counts for the day it was finished", () => {
    const evening = new Date(2024, 5, 1, 23, 58);
    const after = new Date(2024, 5, 2, 0, 3);
    let run = startRun(["a", "b"], evening);
    run = recordAnswer(run, "a", "know", evening);
    run = recordAnswer(run, "b", "know", after);
    expect(dayKey(new Date(run.completedAt!))).toBe("2024-06-02");
    // And it still reads as today's result after midnight.
    expect(runProgress(run, "2024-06-02").status).toBe("done");
  });

  it("keeps the first completion time when a word is answered again", () => {
    let run = runWith(["a"], { a: "know" });
    const done = run.completedAt;
    run = recordAnswer(run, "a", "dontKnow", localNoon(2024, 6, 2));
    expect(run.completedAt).toBe(done);
  });
});

describe("startRun", () => {
  it("starts with nothing answered, whatever came before", () => {
    const finished = runWith(["a", "b"], { a: "know", b: "know" });
    const fresh = startRun(finished.wordIds, NOW);
    expect(fresh.answers).toEqual({});
    expect(fresh.completedAt).toBeNull();
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
    const before = startRun(["a", "b"], NOW);
    const after = recordAnswer(before, "a", "know", NOW);
    expect(before.answers).toEqual({});
    expect(after.answers).toEqual({ a: "know" });
  });

  it("ignores a word that isn't in the run", () => {
    const run = startRun(["a"], NOW);
    expect(recordAnswer(run, "z", "know", NOW)).toBe(run);
  });

  it("maps exercise results onto run answers", () => {
    expect(runAnswerFor("correct")).toBe("know");
    expect(runAnswerFor("almost")).toBe("know");
    expect(runAnswerFor("wrong")).toBe("dontKnow");
    expect(runAnswerFor("dont_know")).toBe("dontKnow");
    expect(runAnswerFor("skipped")).toBe("skipped");
    expect(runAnswerFor("exposure")).toBe("seen");
  });
});

describe("resuming", () => {
  const plan: PlannedStep[] = [
    { kind: "flashcard", wordIds: ["a"], graded: false },
    { kind: "multiple_choice", wordIds: ["a"], graded: true },
    { kind: "active_recall", wordIds: ["b"], graded: true },
    { kind: "matching", wordIds: ["c", "d", "e", "f"], graded: true },
  ];

  it("resumes with the steps whose words are still unanswered, in order", () => {
    let run = startRun(["a", "b", "c", "d", "e", "f"], NOW, { plan });
    run = recordAnswer(run, "b", "know", NOW);
    expect(remainingSteps(run)).toEqual([plan[0], plan[1], plan[3]]);
    run = recordAnswer(run, "a", "dontKnow", NOW);
    expect(remainingSteps(run)).toEqual([plan[3]]);
  });

  it("resumes a half-done Matching grid with just its unmatched words", () => {
    let run = startRun(["c", "d", "e", "f"], NOW, { plan: [plan[3]] });
    run = recordAnswer(run, "c", "know", NOW);
    run = recordAnswer(run, "e", "dontKnow", NOW);
    expect(remainingSteps(run)).toEqual([{ kind: "matching", wordIds: ["d", "f"], graded: true }]);
  });

  it("drops deleted words from the plan too", () => {
    const run = startRun(["a", "b", "c", "d", "e", "f"], NOW, { plan });
    const pruned = pruneRun(run, (id) => id !== "a" && id !== "c");
    expect(pruned.plan).toEqual([
      plan[2],
      { kind: "matching", wordIds: ["d", "e", "f"], graded: true },
    ]);
  });
});

describe("pruneRun", () => {
  it("is a no-op when every word is still in the deck", () => {
    const run = runWith(["a", "b"], { a: "know" });
    expect(pruneRun(run, () => true)).toBe(run);
  });

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

describe("deferred words", () => {
  it("are recorded on the run, once each", () => {
    const run = deferWords(startRun(["a", "b"], NOW), ["a", "a"]);
    expect(run.deferred).toEqual(["a"]);
  });

  it("leave a run without any untouched", () => {
    const run = startRun(["a"], NOW);
    expect(deferWords(run, [])).toBe(run);
  });

  it("are dropped with a word that leaves the deck", () => {
    const run = deferWords(startRun(["a", "b"], NOW), ["a", "b"]);
    expect(pruneRun(run, (id) => id !== "a").deferred).toEqual(["b"]);
  });
});

describe("priorItems (resuming a session)", () => {
  const plan: PlannedStep[] = [
    { kind: "flashcard", wordIds: ["a"], graded: false },
    { kind: "active_recall", wordIds: ["a"], graded: true },
    { kind: "matching", wordIds: ["b", "c", "d", "e"], graded: true },
  ];

  it("counts right answers as mastered and puts misses back in review, asked as before", () => {
    const run = { ...runWith(["a", "b", "c", "d", "e"], { a: "dontKnow", b: "know", c: "dontKnow" }), plan };
    expect(priorItems(run)).toEqual({
      completed: ["b"],
      review: [
        { id: "a", kind: "active_recall", misses: 1 },
        { id: "c", kind: "matching", misses: 1 },
      ],
    });
  });

  it("re-asks an older run's skipped Listening word without audio, and not as a mistake", () => {
    const run = runWith(["a"], { a: "skipped" });
    expect(priorItems(run).review).toEqual([{ id: "a", kind: "multiple_choice", misses: 0 }]);
  });
});

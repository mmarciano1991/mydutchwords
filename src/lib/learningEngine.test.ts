import { describe, expect, it } from "vitest";
import {
  dayKey,
  dueSummary,
  exerciseTierFor,
  gradeWord,
  migrateWords,
  newWord,
  planExercises,
  restoreLegacy,
  selectReplayWords,
  selectSessionWords,
  type ExerciseContext,
  type ExerciseType,
  type HistoryRow,
  type ReviewResult,
  type Word,
} from "./learningEngine";
import { MAX_NEW_WORDS_PER_SESSION } from "./learningConfig";

/* Every test runs on a simulated clock: `day(n)` is 10:00 local time, n
   calendar days after a fixed start. Nothing reads the real clock. */
const START = new Date(2026, 0, 5, 10, 0, 0, 0); // a Monday
function day(n: number, hour = 10): Date {
  const d = new Date(START);
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function midnight(n: number): string {
  const d = day(n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function answer(w: Word, type: ExerciseType, result: ReviewResult, at: Date): Word {
  return gradeWord(w, { exerciseType: type, result }, at).word;
}

/** Deterministic random source. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const ALL: ReadonlySet<ExerciseType> = new Set<ExerciseType>([
  "flashcard",
  "multiple_choice",
  "matching",
  "listening",
  "sentence_completion",
  "active_recall",
]);

function ctx(over: Partial<ExerciseContext> = {}): ExerciseContext {
  return {
    deckSize: 30,
    supported: ALL,
    audioEnabled: true,
    hasAudio: () => true,
    hasSentence: () => true,
    ...over,
  };
}

/** A word that is already Learning, last reviewed `reviewedDay`, due after `interval`. */
function learningWord(id: string, reviewedDay: number, interval: number, over: Partial<Word> = {}): Word {
  return {
    ...newWord(id, day(-30)),
    state: "learning",
    interval,
    evidenceTier: 1,
    successfulReviewDays: 1,
    reps: 1,
    lastReviewedAt: day(reviewedDay).toISOString(),
    lastGradedDay: dayKey(day(reviewedDay)),
    lastResult: "correct",
    dueDate: midnight(reviewedDay + interval),
    ...over,
  };
}

describe("state transitions", () => {
  it("New + correct recognition → Learning, due tomorrow", () => {
    const w = answer(newWord("a", day(0)), "multiple_choice", "correct", day(0));
    expect(w.state).toBe("learning");
    expect(w.interval).toBe(1);
    expect(w.dueDate).toBe(midnight(1));
    expect(w.evidenceTier).toBe(1);
  });

  it("New + wrong → stays New, due tomorrow, and the next exercise is easier", () => {
    const w = answer(newWord("a", day(0)), "multiple_choice", "wrong", day(0));
    expect(w.state).toBe("new");
    expect(w.dueDate).toBe(midnight(1));
    // Back to a flashcard intro before its recognition exercise.
    const plan = planExercises([w], ctx(), seeded());
    expect(plan.map((s) => s.kind)[0]).toBe("flashcard");
    expect(plan[0].graded).toBe(false);
  });

  it("a miss on a Learning word steps its next exercise down a tier", () => {
    const w = learningWord("a", 0, 4, { evidenceTier: 2 });
    const missed = answer(w, "active_recall", "wrong", day(4));
    expect(missed.evidenceTier).toBe(1);
    expect(exerciseTierFor(missed)).toBe(0);
    const plan = planExercises([missed], ctx(), seeded());
    expect(plan[0].kind).toBe("flashcard");
    expect(["multiple_choice", "matching", "listening"]).toContain(plan[1].kind);
  });

  it("Listening skip → no state change, and the next exercise isn't Listening", () => {
    const w = learningWord("a", 0, 1);
    const { word: skipped, graded, event } = gradeWord(w, { exerciseType: "listening", result: "skipped" }, day(1));
    expect(graded).toBe(false);
    expect(event.result).toBe("skipped");
    expect({ ...skipped, listeningSkipped: false }).toEqual(w);
    for (let seed = 1; seed < 40; seed++) {
      const plan = planExercises([skipped], ctx({ supported: new Set(["listening", "multiple_choice"]) }), seeded(seed));
      expect(plan.some((s) => s.kind === "listening")).toBe(false);
    }
  });

  it("\"I don't know\" is scheduled like wrong, with a smaller ease penalty", () => {
    const w = learningWord("a", 0, 4, { ease: 2.3 });
    const wrong = answer(w, "active_recall", "wrong", day(4));
    const dunno = answer(w, "active_recall", "dont_know", day(4));
    expect(dunno.interval).toBe(wrong.interval);
    expect(dunno.dueDate).toBe(wrong.dueDate);
    expect(dunno.state).toBe(wrong.state);
    expect(wrong.ease).toBeCloseTo(2.1);
    expect(dunno.ease).toBeCloseTo(2.2);
    expect(dunno.lastResult).toBe("dont_know");
  });

  it("correct answers on days 1, 2, 4, 8 with one production success → Learned on day 8", () => {
    let w = newWord("a", day(0));
    w = answer(w, "multiple_choice", "correct", day(1));
    w = answer(w, "multiple_choice", "correct", day(2));
    w = answer(w, "matching", "correct", day(4));
    expect(w.state).toBe("learning");
    w = answer(w, "active_recall", "correct", day(8));
    expect(w.state).toBe("learned");
    expect(w.successfulReviewDays).toBe(4);
    expect(w.interval).toBeGreaterThanOrEqual(7);
  });

  it("6 correct answers on the same day → still Learning, interval unchanged after the first", () => {
    let w = answer(newWord("a", day(0)), "multiple_choice", "correct", day(1));
    const after = w;
    for (let i = 0; i < 5; i++) {
      const out = gradeWord(w, { exerciseType: "active_recall", result: "correct" }, day(1, 11 + i));
      expect(out.graded).toBe(false);
      w = out.word;
    }
    expect(w).toEqual(after);
    expect(w.state).toBe("learning");
    expect(w.interval).toBe(1);
  });

  it("correct answers on many days, recognition only → never Learned", () => {
    let w = newWord("a", day(0));
    for (const d of [1, 2, 4, 8, 16, 32]) w = answer(w, "multiple_choice", "correct", day(d));
    expect(w.successfulReviewDays).toBe(6);
    expect(w.hasProductionSuccess).toBe(false);
    expect(w.state).toBe("learning");
  });

  it("Learned + wrong → Learning, due tomorrow, keeps prior evidence", () => {
    const w = learningWord("a", 0, 20, { state: "learned", successfulReviewDays: 5, hasProductionSuccess: true, evidenceTier: 3 });
    const missed = answer(w, "active_recall", "wrong", day(20));
    expect(missed.state).toBe("learning");
    expect(missed.interval).toBe(1);
    expect(missed.dueDate).toBe(midnight(21));
    expect(missed.lapses).toBe(1);
    expect(missed.successfulReviewDays).toBe(5);
    expect(missed.hasProductionSuccess).toBe(true);
    expect(missed.evidenceTier).toBe(2);
  });

  it("3 consecutive failures → back to New, tier 0", () => {
    let w = learningWord("a", 0, 1, { evidenceTier: 2 });
    w = answer(w, "active_recall", "wrong", day(1));
    w = answer(w, "multiple_choice", "wrong", day(2));
    expect(w.state).toBe("learning");
    w = answer(w, "multiple_choice", "dont_know", day(3));
    expect(w.state).toBe("new");
    expect(w.evidenceTier).toBe(0);
  });

  it("\"almost\" counts as correct, with the recognition multiplier and no ease gain", () => {
    const w = learningWord("a", 0, 4, { evidenceTier: 2 });
    const exact = answer(w, "active_recall", "correct", day(4));
    const typo = answer(w, "active_recall", "almost", day(4));
    expect(typo.state).toBe("learning");
    expect(typo.reps).toBe(exact.reps);
    expect(typo.interval).toBeLessThan(exact.interval);
    expect(typo.ease).toBe(w.ease);
    expect(exact.ease).toBeCloseTo(2.35);
  });

  it("caps the interval at 180 days", () => {
    const w = learningWord("a", 0, 170, { state: "learned", ease: 3 });
    expect(answer(w, "active_recall", "correct", day(400)).interval).toBe(180);
  });
});

describe("core rules", () => {
  it("a session asks each word in exactly one graded step", () => {
    const words = [
      newWord("n1", day(0)),
      answer(newWord("m", day(0)), "multiple_choice", "wrong", day(0)),
      learningWord("l1", 0, 1),
      learningWord("l2", 0, 1, { evidenceTier: 2 }),
      learningWord("l3", 0, 1, { evidenceTier: 3 }),
    ];
    const plan = planExercises(words, ctx({ supported: new Set(["flashcard", "multiple_choice", "active_recall"]) }), seeded());
    for (const w of words) {
      expect(plan.filter((s) => s.graded && s.wordIds.includes(w.id))).toHaveLength(1);
    }
  });

  it("a wrong word isn't selected for a second session on the same day — and leads the next day", () => {
    const deck = [learningWord("a", -1, 1), learningWord("b", -1, 1)];
    const first = selectSessionWords(deck, day(0), { size: 10 });
    expect(first.map((w) => w.id).sort()).toEqual(["a", "b"]);
    const after = deck.map((w) => answer(w, "multiple_choice", w.id === "a" ? "wrong" : "correct", day(0)));
    expect(selectSessionWords(after, day(0, 18), { size: 10 })).toEqual([]);
    expect(selectSessionWords(after, day(1), { size: 10 })[0].id).toBe("a");
  });

  it("a replay round repeats today's words — missed ones first — once nothing is left to grade", () => {
    const deck = [learningWord("a", -1, 1), learningWord("b", -1, 1), learningWord("c", 5, 1)];
    const after = deck.map((w) =>
      w.id === "c" ? w : answer(w, "multiple_choice", w.id === "a" ? "wrong" : "correct", day(0))
    );
    const replay = selectReplayWords(after, day(0, 18), 10, seeded());
    expect(replay.map((w) => w.id)).toEqual(["a", "b", "c"]);
    expect(selectReplayWords(after, day(0, 18), 2, seeded())).toHaveLength(2);
  });

  it("a flashcard \"Got it\" never contributes to promotion", () => {
    let w = newWord("a", day(0));
    for (let d = 0; d < 20; d++) {
      const out = gradeWord(w, { exerciseType: "flashcard", result: "exposure" }, day(d));
      expect(out.graded).toBe(false);
      w = out.word;
    }
    expect(w.state).toBe("new");
    expect(w.successfulReviewDays).toBe(0);
  });

  it("a practice round is logged but never graded", () => {
    const w = learningWord("a", 0, 1);
    const out = gradeWord(w, { exerciseType: "multiple_choice", result: "wrong", practice: true }, day(1));
    expect(out.graded).toBe(false);
    expect(out.word).toBe(w);
    expect(out.event.result).toBe("wrong");
  });

  it("an early review earns nothing; an on-time one grows the interval", () => {
    const w = learningWord("a", 0, 6);
    const early = answer(w, "active_recall", "correct", day(2));
    const onTime = answer(w, "active_recall", "correct", day(6));
    expect(early.interval).toBe(w.interval);
    expect(onTime.interval).toBeGreaterThan(w.interval);
  });

  it("logs the state and interval on either side of a graded answer", () => {
    const { event } = gradeWord(newWord("a", day(0)), { exerciseType: "multiple_choice", result: "correct", sessionId: "s1", responseTimeMs: 1200 }, day(0));
    expect(event).toMatchObject({
      wordId: "a",
      sessionId: "s1",
      localDate: dayKey(day(0)),
      graded: true,
      stateBefore: "new",
      stateAfter: "learning",
      intervalBefore: 0,
      intervalAfter: 1,
      responseTimeMs: 1200,
    });
  });
});

describe("exercise eligibility", () => {
  it("drops Multiple Choice for a deck under 4 words, falling back to a flashcard", () => {
    const plan = planExercises([newWord("a", day(0))], ctx({ deckSize: 3, supported: new Set(["flashcard", "multiple_choice"]) }), seeded());
    expect(plan).toEqual([{ kind: "flashcard", wordIds: ["a"], graded: false }]);
  });

  it("keeps Multiple Choice for a small deck when the dictionary can top up its options", () => {
    const plan = planExercises(
      [newWord("a", day(0))],
      ctx({ deckSize: 1, fillChoices: true, supported: new Set(["flashcard", "multiple_choice"]) }),
      seeded()
    );
    expect(plan).toEqual([
      { kind: "flashcard", wordIds: ["a"], graded: false },
      { kind: "multiple_choice", wordIds: ["a"], graded: true },
    ]);
  });

  it("never picks Sentence Completion without a sentence", () => {
    const w = learningWord("a", 0, 1, { evidenceTier: 2, lastExerciseType: "active_recall" });
    for (let seed = 1; seed < 30; seed++) {
      const plan = planExercises([w], ctx({ hasSentence: () => false }), seeded(seed));
      expect(plan[0].kind).toBe("active_recall");
    }
  });

  it("never picks Listening without audio, or with audio turned off", () => {
    const w = learningWord("a", 0, 1);
    const only = new Set<ExerciseType>(["listening", "multiple_choice"]);
    for (let seed = 1; seed < 30; seed++) {
      expect(planExercises([w], ctx({ supported: only, hasAudio: () => false }), seeded(seed))[0].kind).toBe("multiple_choice");
      expect(planExercises([w], ctx({ supported: only, audioEnabled: false }), seeded(seed))[0].kind).toBe("multiple_choice");
    }
  });

  it("prefers an exercise different from the last one", () => {
    const w = learningWord("a", 0, 1, { lastExerciseType: "multiple_choice" });
    for (let seed = 1; seed < 30; seed++) {
      expect(planExercises([w], ctx({ supported: new Set(["multiple_choice", "listening"]) }), seeded(seed))[0].kind).toBe("listening");
    }
  });

  it("groups Matching into grids of 4–5 and re-picks for leftovers", () => {
    const words = Array.from({ length: 9 }, (_, i) => learningWord(`w${i}`, 0, 1));
    const plan = planExercises(words, ctx({ supported: new Set(["matching"]) }), seeded());
    const grids = plan.filter((s) => s.kind === "matching");
    expect(grids.map((g) => g.wordIds.length).sort()).toEqual([4, 5]);

    const three = Array.from({ length: 3 }, (_, i) => learningWord(`x${i}`, 0, 1));
    const fallback = planExercises(three, ctx({ supported: new Set(["matching", "multiple_choice"]) }), seeded());
    expect(fallback.every((s) => s.kind === "multiple_choice")).toBe(true);
  });

  it("gathers one Matching grid when enough words would otherwise get Multiple Choice", () => {
    for (let seed = 1; seed < 20; seed++) {
      const words = Array.from({ length: 5 }, (_, i) => learningWord(`m${i}`, 0, 1));
      const plan = planExercises(words, ctx({ supported: new Set(["multiple_choice", "matching"]) }), seeded(seed));
      expect(plan.filter((s) => s.kind === "matching")).toHaveLength(1);
    }
  });

  it("introduces new words on a Matching grid with their flashcards first", () => {
    const words = Array.from({ length: 4 }, (_, i) => newWord(`n${i}`, day(0)));
    const plan = planExercises(words, ctx({ supported: new Set(["flashcard", "matching"]) }), seeded());
    expect(plan.map((s) => s.kind)).toEqual(["flashcard", "flashcard", "flashcard", "flashcard", "matching"]);
    expect(plan[4].wordIds.sort()).toEqual(["n0", "n1", "n2", "n3"]);
  });

  it("puts a tier-0 word's flashcard intro directly before its exercise", () => {
    const words = [newWord("a", day(0)), newWord("b", day(0)), learningWord("c", 0, 1)];
    const plan = planExercises(words, ctx({ supported: new Set(["flashcard", "multiple_choice", "active_recall"]) }), seeded(3));
    for (const id of ["a", "b"]) {
      const i = plan.findIndex((s) => s.wordIds.includes(id));
      expect(plan[i]).toMatchObject({ kind: "flashcard", graded: false });
      expect(plan[i + 1]).toMatchObject({ wordIds: [id], graded: true });
    }
  });

  it("avoids two steps of the same kind in a row when it can", () => {
    const words = [
      learningWord("a", 0, 1),
      learningWord("b", 0, 1),
      learningWord("c", 0, 1, { evidenceTier: 3 }),
      learningWord("d", 0, 1, { evidenceTier: 3 }),
    ];
    const supported = new Set<ExerciseType>(["multiple_choice", "active_recall"]);
    for (let seed = 1; seed < 20; seed++) {
      const kinds = planExercises(words, ctx({ supported, hasSentence: () => false }), seeded(seed)).map((s) => s.kind);
      for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    }
  });
});

describe("session selection", () => {
  const dueDeck = (n: number) => Array.from({ length: n }, (_, i) => learningWord(`d${i}`, -2, 1));

  it.each([10, 20, 30])("fills a session of %i", (size) => {
    expect(selectSessionWords(dueDeck(40), day(0), { size })).toHaveLength(size);
  });

  it("is every eligible word when there are fewer than the size", () => {
    expect(selectSessionWords(dueDeck(7), day(0), { size: 20 })).toHaveLength(7);
  });

  it("caps new words, even right after capturing 20 at once", () => {
    const deck = Array.from({ length: 20 }, (_, i) => ({ ...newWord(`n${i}`, day(0)), dateAdded: i }));
    const session = selectSessionWords(deck, day(0), { size: 20 });
    expect(session).toHaveLength(MAX_NEW_WORDS_PER_SESSION);
    expect(session.map((w) => w.id)).toEqual(["n0", "n1", "n2", "n3", "n4"]);
  });

  it("orders by priority: failed-due > overdue > due today > learned due > new > not yet due", () => {
    const deck = [
      { ...newWord("new", day(-1)), dateAdded: 1 },
      learningWord("ahead", -1, 5),
      learningWord("learned", -10, 10, { state: "learned" }),
      learningWord("today", -1, 1),
      learningWord("overdue", -5, 2),
      learningWord("failed", -1, 1, { lastResult: "wrong" }),
    ];
    expect(selectSessionWords(deck, day(0, 12), { size: 10 }).map((w) => w.id)).toEqual([
      "failed",
      "overdue",
      "today",
      "learned",
      "new",
      "ahead",
    ]);
  });

  it("a missed-words session holds only missed words that are due", () => {
    const deck = [
      learningWord("missed", -1, 1, { lastResult: "dont_know" }),
      learningWord("missedLater", 0, 1, { lastResult: "wrong", lastGradedDay: dayKey(day(-1)) }),
      learningWord("fine", -1, 1),
    ];
    expect(selectSessionWords(deck, day(0), { size: 10, kind: "missed" }).map((w) => w.id)).toEqual(["missed"]);
  });

  it("a second session the same day excludes words graded today, and is empty once nothing is left", () => {
    let deck = dueDeck(12);
    const first = selectSessionWords(deck, day(0), { size: 10 });
    const graded = new Set(first.map((w) => w.id));
    deck = deck.map((w) => (graded.has(w.id) ? answer(w, "multiple_choice", "correct", day(0)) : w));
    const second = selectSessionWords(deck, day(0, 15), { size: 10 });
    expect(second).toHaveLength(2);
    expect(second.some((w) => graded.has(w.id))).toBe(false);
    deck = deck.map((w) => answer(w, "multiple_choice", "correct", day(0, 16)));
    expect(selectSessionWords(deck, day(0, 17), { size: 10 })).toEqual([]);
  });

  it("splits the review queue into missed, due and new", () => {
    const deck = [
      learningWord("m", -1, 1, { lastResult: "wrong" }),
      learningWord("d", -1, 1),
      learningWord("ok", 0, 3),
      newWord("n", day(0)),
    ];
    const s = dueSummary(deck, day(0, 12));
    expect(s.missed).toEqual(["m"]);
    expect(s.dueForReview).toEqual(["d"]);
    expect(s.newWords).toEqual(["n"]);
    expect(s.counts).toEqual({ new: 1, learning: 3, learned: 0 });
  });
});

describe("migration", () => {
  const ms = (n: number) => day(n).getTime();
  function v1(id: string, over: Record<string, unknown> = {}) {
    return { id, dateAdded: 1, level: 0, interval: 0, reps: 0, dueDate: midnight(0), lapses: 0, state: "new", lastReviewedAt: null, ...over };
  }
  const know = (id: string, d: number): HistoryRow => ({ entryId: id, grade: "know", timestamp: ms(d) });
  const miss = (id: string, d: number): HistoryRow => ({ entryId: id, grade: "dontKnow", timestamp: ms(d) });

  it("keeps a never-practised word New", () => {
    const [w] = migrateWords([v1("a")], [], day(10));
    expect(w.state).toBe("new");
    expect(w.evidenceTier).toBe(0);
    expect(w.dueDate).toBe(midnight(0));
  });

  it("preserves progress: correct history → Learning, tier 1, interval and due date kept", () => {
    const old = v1("a", { level: 3, interval: 7, reps: 3, state: "learning", dueDate: midnight(12), lastReviewedAt: day(5).toISOString() });
    const [w] = migrateWords([old], [know("a", 1), know("a", 2), know("a", 5)], day(10));
    expect(w).toMatchObject({ state: "learning", evidenceTier: 1, interval: 7, dueDate: midnight(12), successfulReviewDays: 3, ease: 2.3 });
    expect(w.legacy).toMatchObject({ level: 3, interval: 7, reps: 3, state: "learning" });
    expect(w.dateAdded).toBe(1);
  });

  it("never jumps to Learned without spaced evidence, even from the old top level", () => {
    const old = v1("a", { level: 6, interval: 90, reps: 6, state: "mature", dueDate: midnight(80) });
    // Six "correct" answers squeezed into three nearby days.
    const rows = [know("a", 1), know("a", 1), know("a", 2), know("a", 2), know("a", 3), know("a", 3)];
    expect(migrateWords([old], rows, day(10))[0].state).toBe("learning");
  });

  it("starts as Learned with correct answers on 3+ days, the last gap ≥ 4 days", () => {
    const old = v1("a", { level: 4, interval: 14, reps: 4, state: "learning", dueDate: midnight(20) });
    const [w] = migrateWords([old], [know("a", 0), know("a", 3), know("a", 7)], day(10));
    expect(w.state).toBe("learned");
    expect(w.evidenceTier).toBe(3);
  });

  it("treats a word only ever missed as New, remembering it was missed", () => {
    const old = v1("a", { level: 0, interval: 1, state: "learning", lapses: 2, dueDate: midnight(4) });
    const [w] = migrateWords([old], [miss("a", 2), miss("a", 3)], day(4));
    expect(w.state).toBe("new");
    expect(w.lastResult).toBe("wrong");
    expect(w.lapses).toBe(2);
  });

  it("is idempotent: running it twice changes nothing", () => {
    const deck = [v1("a", { level: 2, interval: 3, reps: 2, state: "learning" }), v1("b")];
    const rows = [know("a", 1), know("a", 2)];
    const once = migrateWords(deck, rows, day(5));
    const twice = migrateWords(once, rows, day(9));
    expect(twice).toEqual(once);
    expect(twice[0]).toBe(once[0]);
  });

  it("can be rolled back to the pre-migration values", () => {
    const old = v1("a", { level: 3, interval: 7, reps: 3, state: "learning", dueDate: midnight(12) });
    const [w] = migrateWords([old], [know("a", 1)], day(10));
    expect(restoreLegacy(w)).toMatchObject({ level: 3, interval: 7, reps: 3, state: "learning", dueDate: midnight(12) });
  });
});

describe("early recall (a word pulled forward before it is due)", () => {
  const grade = (w: Word, result: ReviewResult, at: Date) =>
    gradeWord(w, { exerciseType: "active_recall", result, responseTimeMs: 3000, sessionId: null, practice: false }, at);

  it("doesn't promote a word recalled before it is due", () => {
    const ahead = learningWord("early", -1, 3); // reviewed yesterday, due in 2 days
    const out = grade(ahead, "correct", day(0));
    expect(out.graded).toBe(false);
    expect(out.word).toEqual(ahead);
  });

  it("still counts a miss on a word that isn't due yet", () => {
    const ahead = learningWord("early", -1, 3);
    const out = grade(ahead, "wrong", day(0));
    expect(out.graded).toBe(true);
    expect(out.word.interval).toBeLessThan(ahead.interval + 1);
  });

  // Daily practice of a deck no bigger than the day's goal tops the session
  // up with words that aren't due; grading those walked every word to
  // Learned in six days.
  it("doesn't let a small deck practised daily reach Learned in a week", () => {
    let w = newWord("w", day(0));
    for (let d = 0; d < 7; d++) w = grade(w, "correct", day(d)).word;
    expect(w.state).not.toBe("learned");
  });
});

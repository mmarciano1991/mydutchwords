import { describe, expect, it } from "vitest";
import {
  applyGrade,
  buildNextSession,
  buildRestudySession,
  buildSession,
  buildSessionReport,
  isLeech,
  markAsKnown,
  type ReviewedCard,
  type Word,
} from "./learningEngine";

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "w1",
    interval: 0,
    ease: 2.5,
    reps: 0,
    dueDate: new Date("2024-01-01T00:00:00.000Z").toISOString(),
    lapses: 0,
    state: "new",
    lastReviewedAt: null,
    ...overrides,
  };
}

const NOW = new Date("2024-06-01T12:00:00.000Z");

function daysBetween(a: string, b: Date): number {
  return Math.round((new Date(a).getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

describe("applyGrade", () => {
  it("1. Easy -> Easy -> Easy produces intervals 1 -> 6 -> round(6 * ease)", () => {
    let word = makeWord();

    word = applyGrade(word, "easy", NOW);
    expect(word.reps).toBe(1);
    expect(word.interval).toBe(1);
    expect(word.ease).toBeCloseTo(2.6);

    word = applyGrade(word, "easy", NOW);
    expect(word.reps).toBe(2);
    expect(word.interval).toBe(6);
    expect(word.ease).toBeCloseTo(2.7);

    const easeBeforeThird = word.ease;
    word = applyGrade(word, "easy", NOW);
    expect(word.reps).toBe(3);
    expect(word.interval).toBe(Math.round(6 * easeBeforeThird));
  });

  it("2. dontKnow resets reps to 0, sets interval to 1, decreases ease by 0.2 (floored at 1.3)", () => {
    const word = makeWord({ reps: 4, interval: 20, ease: 2.5, lapses: 1 });
    const next = applyGrade(word, "dontKnow", NOW);
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.ease).toBeCloseTo(2.3);
    expect(next.lapses).toBe(2);

    const lowEaseWord = makeWord({ ease: 1.35 });
    const flooredNext = applyGrade(lowEaseWord, "dontKnow", NOW);
    expect(flooredNext.ease).toBe(1.3);
  });

  it("3. repeated Hard grades slow growth but never fully stall (ease floor)", () => {
    let word = makeWord({ interval: 10, ease: 1.32 });
    for (let i = 0; i < 5; i++) {
      word = applyGrade(word, "hard", NOW);
    }
    expect(word.ease).toBe(1.3);
    // interval keeps growing by 1.2x each time, never stalling at floor ease
    expect(word.interval).toBeGreaterThan(10);
  });

  it("4. transitions from learning to mature exactly when interval crosses 60", () => {
    // round(50 * 1.18) = 59 -> still learning
    const below = applyGrade(makeWord({ reps: 2, interval: 50, ease: 1.18 }), "easy", NOW);
    expect(below.interval).toBe(59);
    expect(below.state).toBe("learning");

    // round(50 * 1.2) = 60 -> crosses into mature
    const atOrAbove = applyGrade(makeWord({ reps: 2, interval: 50, ease: 1.2 }), "easy", NOW);
    expect(atOrAbove.interval).toBe(60);
    expect(atOrAbove.state).toBe("mature");
  });
});

describe("isLeech", () => {
  it("5. returns true at exactly 4 lapses, false at 3", () => {
    expect(isLeech(makeWord({ lapses: 3 }))).toBe(false);
    expect(isLeech(makeWord({ lapses: 4 }))).toBe(true);
  });
});

describe("buildSession", () => {
  function dueWord(id: string, overrides: Partial<Word> = {}): Word {
    return makeWord({
      id,
      state: "learning",
      interval: 5,
      dueDate: new Date(NOW.getTime() - 1000).toISOString(),
      ...overrides,
    });
  }

  function freshWord(id: string): Word {
    return makeWord({ id, state: "new" });
  }

  it("6. prioritizes all due reviews before adding any new words", () => {
    const due = [dueWord("d1"), dueWord("d2")];
    const fresh = [freshWord("n1"), freshWord("n2")];
    const session = buildSession([...fresh, ...due], NOW, { maxHardCap: 3 });
    expect(session.map((w) => w.id)).toEqual(["d1", "d2", "n1"]);
  });

  it("7. respects maxSessionMinutes over maxHardCap when time budget is hit first, and vice versa", () => {
    const fresh = Array.from({ length: 20 }, (_, i) => freshWord(`n${i}`));

    // Time budget binds first: 2 minutes / 12s per card = 10 cards, well under the 25 cap.
    const timeBound = buildSession(fresh, NOW, {
      maxSessionMinutes: 2,
      secondsPerCard: 12,
      maxHardCap: 25,
      maxNewWordsPerSession: 25,
    });
    expect(timeBound).toHaveLength(10);

    // Hard cap binds first: huge time budget, but capped at 5 cards.
    const capBound = buildSession(fresh, NOW, {
      maxSessionMinutes: 60,
      secondsPerCard: 12,
      maxHardCap: 5,
      maxNewWordsPerSession: 25,
    });
    expect(capBound).toHaveLength(5);
  });

  it("8. returns only due reviews (no new words) when due reviews alone exceed the cap", () => {
    const due = Array.from({ length: 8 }, (_, i) => dueWord(`d${i}`));
    const fresh = [freshWord("n1"), freshWord("n2")];
    const session = buildSession([...fresh, ...due], NOW, { maxHardCap: 5 });
    expect(session).toHaveLength(5);
    expect(session.every((w) => w.state !== "new")).toBe(true);
  });
});

describe("markAsKnown", () => {
  it("9. produces a word in mature state with a 90-day due date", () => {
    const word = makeWord();
    const known = markAsKnown(word, NOW);
    expect(known.interval).toBe(90);
    expect(known.ease).toBe(2.5);
    expect(known.reps).toBe(2);
    expect(known.state).toBe("mature");
    expect(daysBetween(known.dueDate, NOW)).toBe(90);
  });
});

describe("buildSessionReport", () => {
  it("10. separates dontKnowWords from known cards and preserves review order", () => {
    const reviewed: ReviewedCard[] = [
      { word: makeWord({ id: "a" }), grade: "easy" },
      { word: makeWord({ id: "b" }), grade: "dontKnow" },
      { word: makeWord({ id: "c" }), grade: "hard" },
      { word: makeWord({ id: "d" }), grade: "dontKnow" },
    ];
    const report = buildSessionReport(reviewed);
    expect(report.totalReviewed).toBe(4);
    expect(report.knownCount).toBe(2);
    expect(report.dontKnowWords.map((w) => w.id)).toEqual(["b", "d"]);
  });
});

describe("buildRestudySession", () => {
  it("11. returns only the dontKnowWords, capped the same way as a normal session", () => {
    const dontKnowWords = Array.from({ length: 30 }, (_, i) => makeWord({ id: `w${i}` }));
    const report = buildSessionReport(
      dontKnowWords.map((word) => ({ word, grade: "dontKnow" as const }))
    );
    const restudy = buildRestudySession(report, { maxHardCap: 25 });
    expect(restudy).toHaveLength(25);
    expect(restudy.map((w) => w.id)).toEqual(dontKnowWords.slice(0, 25).map((w) => w.id));
  });
});

describe("buildNextSession", () => {
  it("12. excludes already-reviewed word ids and pulls the next batch, respecting maxHardCap", () => {
    const due = Array.from({ length: 30 }, (_, i) =>
      makeWord({
        id: `d${i}`,
        state: "learning",
        interval: 5,
        dueDate: new Date(NOW.getTime() - 1000).toISOString(),
      })
    );
    const reviewedIds = due.slice(0, 10).map((w) => w.id);
    const next = buildNextSession(due, reviewedIds, NOW, { maxHardCap: 12 });
    expect(next).toHaveLength(12);
    expect(next.some((w) => reviewedIds.includes(w.id))).toBe(false);
    expect(next.map((w) => w.id)).toEqual(due.slice(10, 22).map((w) => w.id));
  });
});

import { describe, expect, it } from "vitest";
import {
  applyGrade,
  buildNextSession,
  buildRestudySession,
  buildSession,
  buildSessionReport,
  intervalForLevel,
  isLeech,
  LADDER,
  markAsKnown,
  MAX_LEVEL,
  type ReviewedCard,
  type Word,
} from "./learningEngine";

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "w1",
    level: 0,
    interval: 0,
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

describe("applyGrade — ladder", () => {
  it("climbs the full ladder 1-3-7-14-30-90 on consecutive correct answers", () => {
    let word = makeWord();
    for (let i = 0; i < LADDER.length; i++) {
      word = applyGrade(word, "know", NOW);
      expect(word.level).toBe(i + 1);
      expect(word.interval).toBe(LADDER[i]);
      expect(daysBetween(word.dueDate, NOW)).toBe(LADDER[i]);
    }
    // Further correct answers stay clamped at the top rung.
    word = applyGrade(word, "know", NOW);
    expect(word.level).toBe(MAX_LEVEL);
    expect(word.interval).toBe(90);
  });

  it("dontKnow moves one level down (min 0), resets reps, counts a lapse, reschedules at the lower rung", () => {
    const word = makeWord({ level: 3, interval: 7, reps: 3, state: "learning", lapses: 1 });
    const next = applyGrade(word, "dontKnow", NOW);
    expect(next.level).toBe(2);
    expect(next.interval).toBe(LADDER[1]); // 3 days
    expect(next.reps).toBe(0);
    expect(next.lapses).toBe(2);

    const floor = applyGrade(makeWord({ level: 0 }), "dontKnow", NOW);
    expect(floor.level).toBe(0);
    expect(floor.interval).toBe(1); // level 0 comes back after 1 day
  });

  it("transitions to mature exactly at the top level", () => {
    const almost = applyGrade(makeWord({ level: 4, state: "learning" }), "know", NOW);
    expect(almost.level).toBe(5);
    expect(almost.state).toBe("learning");

    const top = applyGrade(makeWord({ level: 5, state: "learning" }), "know", NOW);
    expect(top.level).toBe(MAX_LEVEL);
    expect(top.state).toBe("mature");
  });

  it("a mature word that is missed drops back to learning", () => {
    const dropped = applyGrade(makeWord({ level: MAX_LEVEL, state: "mature" }), "dontKnow", NOW);
    expect(dropped.level).toBe(MAX_LEVEL - 1);
    expect(dropped.state).toBe("learning");
  });

  it("normalizes due dates to local start-of-day, so reviews unlock at midnight", () => {
    const lateEvening = new Date(2024, 5, 1, 23, 15, 42); // local time
    const next = applyGrade(makeWord(), "know", lateEvening); // level 1 -> +1 day
    const due = new Date(next.dueDate);
    expect([due.getHours(), due.getMinutes(), due.getSeconds()]).toEqual([0, 0, 0]);
    expect(due.getDate()).toBe(2); // tomorrow's calendar day, not 23:15 tomorrow
  });

  it("intervalForLevel maps level 0 to 1 day and clamps above the ladder", () => {
    expect(intervalForLevel(0)).toBe(1);
    expect(intervalForLevel(1)).toBe(1);
    expect(intervalForLevel(6)).toBe(90);
    expect(intervalForLevel(99)).toBe(90);
  });
});

describe("isLeech", () => {
  it("returns true at exactly 4 lapses, false at 3", () => {
    expect(isLeech(makeWord({ lapses: 3 }))).toBe(false);
    expect(isLeech(makeWord({ lapses: 4 }))).toBe(true);
  });
});

describe("buildSession", () => {
  function dueWord(id: string, overrides: Partial<Word> = {}): Word {
    return makeWord({
      id,
      state: "learning",
      level: 2,
      interval: 3,
      dueDate: new Date(NOW.getTime() - 1000).toISOString(),
      ...overrides,
    });
  }

  function freshWord(id: string): Word {
    return makeWord({ id, state: "new" });
  }

  it("prioritizes all due reviews before adding any new words, most overdue first", () => {
    const due = [
      dueWord("d1", { dueDate: new Date(NOW.getTime() - 1000).toISOString() }),
      dueWord("d2", { dueDate: new Date(NOW.getTime() - 5000).toISOString() }), // more overdue
    ];
    const fresh = [freshWord("n1"), freshWord("n2")];
    const session = buildSession([...fresh, ...due], NOW, { maxHardCap: 3 });
    expect(session.map((w) => w.id)).toEqual(["d2", "d1", "n1"]);
  });

  it("respects maxSessionMinutes over maxHardCap when time budget binds first, and vice versa", () => {
    const fresh = Array.from({ length: 20 }, (_, i) => freshWord(`n${i}`));

    const timeBound = buildSession(fresh, NOW, {
      maxSessionMinutes: 2,
      secondsPerCard: 12,
      maxHardCap: 25,
      maxNewWordsPerSession: 25,
    });
    expect(timeBound).toHaveLength(10);

    const capBound = buildSession(fresh, NOW, {
      maxSessionMinutes: 60,
      secondsPerCard: 12,
      maxHardCap: 5,
      maxNewWordsPerSession: 25,
    });
    expect(capBound).toHaveLength(5);
  });

  it("puts leeches (4+ lapses) at the front of the due queue", () => {
    const due = [
      dueWord("normal", { dueDate: new Date(NOW.getTime() - 9000).toISOString() }), // most overdue
      dueWord("leech", { lapses: 4, dueDate: new Date(NOW.getTime() - 1000).toISOString() }),
    ];
    const session = buildSession(due, NOW);
    expect(session.map((w) => w.id)).toEqual(["leech", "normal"]);
  });

  it("returns only due reviews (no new words) when due reviews alone exceed the cap", () => {
    const due = Array.from({ length: 8 }, (_, i) => dueWord(`d${i}`));
    const fresh = [freshWord("n1"), freshWord("n2")];
    const session = buildSession([...fresh, ...due], NOW, { maxHardCap: 5 });
    expect(session).toHaveLength(5);
    expect(session.every((w) => w.state !== "new")).toBe(true);
  });

  it("defaults to a 15-card hard cap", () => {
    const fresh = Array.from({ length: 40 }, (_, i) => freshWord(`n${i}`));
    const due = Array.from({ length: 40 }, (_, i) => dueWord(`d${i}`));
    expect(buildSession([...due, ...fresh], NOW)).toHaveLength(15);
  });
});

describe("markAsKnown", () => {
  it("produces a mature word at the top of the ladder with a 90-day due date", () => {
    const known = markAsKnown(makeWord(), NOW);
    expect(known.level).toBe(MAX_LEVEL);
    expect(known.interval).toBe(90);
    expect(known.state).toBe("mature");
    expect(daysBetween(known.dueDate, NOW)).toBe(90);
  });
});

describe("buildSessionReport", () => {
  it("separates dontKnowWords from known cards and preserves review order", () => {
    const reviewed: ReviewedCard[] = [
      { word: makeWord({ id: "a" }), grade: "know" },
      { word: makeWord({ id: "b" }), grade: "dontKnow" },
      { word: makeWord({ id: "c" }), grade: "know" },
      { word: makeWord({ id: "d" }), grade: "dontKnow" },
    ];
    const report = buildSessionReport(reviewed);
    expect(report.totalReviewed).toBe(4);
    expect(report.knownCount).toBe(2);
    expect(report.dontKnowWords.map((w) => w.id)).toEqual(["b", "d"]);
  });
});

describe("buildRestudySession", () => {
  it("returns only the dontKnowWords, capped the same way as a normal session", () => {
    const dontKnowWords = Array.from({ length: 30 }, (_, i) =>
      makeWord({ id: `w${i}`, state: "learning", dueDate: new Date(NOW.getTime() - 1000).toISOString() })
    );
    const report = buildSessionReport(
      dontKnowWords.map((word) => ({ word, grade: "dontKnow" as const }))
    );
    const restudy = buildRestudySession(report, { maxHardCap: 25 });
    expect(restudy).toHaveLength(25);
  });
});

describe("buildNextSession", () => {
  it("excludes already-reviewed word ids and pulls the next batch, respecting maxHardCap", () => {
    const due = Array.from({ length: 30 }, (_, i) =>
      makeWord({
        id: `d${i}`,
        state: "learning",
        level: 2,
        interval: 3,
        dueDate: new Date(NOW.getTime() - 1000).toISOString(),
      })
    );
    const reviewedIds = due.slice(0, 10).map((w) => w.id);
    const next = buildNextSession(due, reviewedIds, NOW, { maxHardCap: 12 });
    expect(next).toHaveLength(12);
    expect(next.some((w) => reviewedIds.includes(w.id))).toBe(false);
  });
});

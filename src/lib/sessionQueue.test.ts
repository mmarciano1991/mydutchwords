import { describe, expect, it } from "vitest";
import { REVIEW_RETRY_LIMIT } from "./learningConfig";
import type { ExerciseType, PlannedStep } from "./learningEngine";
import {
  answer,
  carryOver,
  comesBackNote,
  createQueue,
  isFinalFor,
  next,
  progress,
  skip,
  type Outcome,
  type SessionQueue,
} from "./sessionQueue";

const step = (kind: ExerciseType, ...wordIds: string[]): PlannedStep => ({ kind, wordIds, graded: kind !== "flashcard" });

/** Answers every item on the current step, then moves on. */
function play(q: SessionQueue, outcome: Outcome): SessionQueue {
  for (const id of q.current!.wordIds) q = answer(q, id, outcome);
  return next(q, outcome === "pass");
}

const onScreen = (q: SessionQueue) => q.current && { ids: q.current.wordIds, kind: q.current.kind, review: q.current.review };
const pct = (q: SessionQueue) => {
  const { mastered, total } = progress(q);
  return `${mastered}/${total}`;
};

describe("progress", () => {
  it("counts unique mastered items, and moves on a correct answer before Continue", () => {
    let q = createQueue([step("multiple_choice", "a"), step("multiple_choice", "b")]);
    expect(pct(q)).toBe("0/2");
    q = answer(q, "a", "pass");
    expect(pct(q)).toBe("1/2");
    q = next(q, true);
    expect(pct(q)).toBe("1/2");
  });

  it("does not count a miss, an unanswered item or an intro flashcard", () => {
    let q = createQueue([step("flashcard", "a"), step("multiple_choice", "a"), step("multiple_choice", "b")]);
    q = next(q, true); // intro flashcard "I knew it"
    expect(pct(q)).toBe("0/2");
    q = play(q, "miss");
    expect(pct(q)).toBe("0/2");
  });

  it("counts an item answered twice only once", () => {
    let q = createQueue([step("multiple_choice", "a"), step("multiple_choice", "b")]);
    q = answer(answer(q, "a", "pass"), "a", "pass");
    expect(pct(q)).toBe("1/2");
    // Nor can a later miss on the same step take it back.
    q = answer(q, "a", "miss");
    expect(q.items.a).toMatchObject({ status: "completed", misses: 0 });
  });

  it("counts an item mastered in review", () => {
    let q = createQueue([step("multiple_choice", "a")]);
    q = play(q, "miss");
    expect(pct(q)).toBe("0/1");
    q = play(q, "pass");
    expect(pct(q)).toBe("1/1");
    expect(q.current).toBeNull();
  });

  it("never goes down, whatever the answers", () => {
    let q = createQueue([step("matching", "a", "b", "c", "d"), step("active_recall", "e"), step("listening", "f")]);
    const outcomes: Outcome[] = ["miss", "pass", "miss", "miss", "pass", "miss", "miss", "pass", "miss", "miss", "pass", "pass"];
    let last = 0;
    for (let i = 0; q.current && i < 50; i++) {
      const o = outcomes[i % outcomes.length];
      for (const id of q.current.wordIds) {
        q = answer(q, id, o);
        expect(progress(q).mastered).toBeGreaterThanOrEqual(last);
        last = progress(q).mastered;
      }
      q = next(q, o === "pass");
      expect(progress(q).total).toBe(6);
    }
    expect(q.current).toBeNull();
  });
});

describe("review queue", () => {
  it("asks the misses after the main queue, in the order they were missed", () => {
    let q = createQueue([step("multiple_choice", "a"), step("active_recall", "b"), step("multiple_choice", "c")]);
    q = play(q, "miss"); // a
    q = play(q, "miss"); // b
    expect(q.review).toEqual(["a", "b"]);
    expect(onScreen(q)).toEqual({ ids: ["c"], kind: "multiple_choice", review: false });
    q = play(q, "pass"); // c
    expect(onScreen(q)).toEqual({ ids: ["a"], kind: "multiple_choice", review: true });
    q = play(q, "pass");
    expect(onScreen(q)).toEqual({ ids: ["b"], kind: "active_recall", review: true });
    expect(q.review).toEqual(["b"]);
  });

  it("takes an item off the review queue once it's right", () => {
    let q = createQueue([step("multiple_choice", "a")]);
    q = play(q, "miss");
    q = answer(q, "a", "pass");
    expect(q.review).toEqual([]);
    expect(q.items.a.status).toBe("completed");
  });

  it("sends a missed review item to the back of the review queue", () => {
    let q = createQueue([step("multiple_choice", "a"), step("multiple_choice", "b")]);
    q = play(play(q, "miss"), "miss");
    q = play(q, "miss"); // a, in review
    expect(q.review).toEqual(["b", "a"]);
    expect(onScreen(q)?.ids).toEqual(["b"]);
  });

  it("reviews a missed Matching word on its own, as Multiple Choice", () => {
    let q = createQueue([step("matching", "a", "b", "c", "d")]);
    q = answer(q, "a", "pass");
    q = answer(q, "b", "miss");
    q = answer(q, "c", "pass");
    q = answer(q, "d", "pass");
    q = next(q, false);
    expect(onScreen(q)).toEqual({ ids: ["b"], kind: "multiple_choice", review: true });
  });

  it("never holds an item twice", () => {
    let q = createQueue([step("multiple_choice", "a")]);
    q = answer(answer(q, "a", "miss"), "a", "miss");
    expect(q.review).toEqual(["a"]);
    expect(q.items.a.misses).toBe(1);
    q = play(play(q, "miss"), "miss");
    expect(new Set(q.review).size).toBe(q.review.length);
  });

  it("settles a flashcard shown in place of an exercise by its rating", () => {
    let q = createQueue([step("flashcard", "a")]);
    q = next(q, false); // "Still learning"
    expect(onScreen(q)).toEqual({ ids: ["a"], kind: "flashcard", review: true });
    q = next(q, true); // "I knew it"
    expect(q.items.a.status).toBe("completed");
    expect(q.current).toBeNull();
  });
});

describe("retry limit and deferral", () => {
  it(`defers an item missed ${REVIEW_RETRY_LIMIT} more times in review, and closes the section`, () => {
    let q = createQueue([step("active_recall", "a"), step("multiple_choice", "b")]);
    q = play(q, "miss"); // a: first miss
    q = play(q, "pass"); // b
    for (let i = 1; i < REVIEW_RETRY_LIMIT; i++) {
      q = play(q, "miss");
      expect(q.items.a.status).toBe("review");
      expect(onScreen(q)?.ids).toEqual(["a"]);
    }
    q = answer(q, "a", "miss");
    expect(q.items.a).toMatchObject({ status: "deferred", misses: REVIEW_RETRY_LIMIT + 1 });
    expect(comesBackNote(q)).toBe("It’ll come back next session.");
    q = next(q, false);
    expect(q.current).toBeNull();
    expect(carryOver(q)).toEqual(["a"]);
    expect(pct(q)).toBe("1/2");
  });

  it("hands on the review items still waiting when the session is left", () => {
    let q = createQueue([step("multiple_choice", "a"), step("multiple_choice", "b"), step("multiple_choice", "c")]);
    q = play(q, "miss");
    q = play(q, "pass");
    expect(carryOver(q)).toEqual(["a"]);
  });

  it("tells a miss it comes back in a moment while it's under review", () => {
    let q = createQueue([step("multiple_choice", "a")]);
    expect(comesBackNote(q)).toBeUndefined();
    q = answer(q, "a", "miss");
    expect(comesBackNote(q)).toBe("It’ll come back in a moment.");
  });
});

describe("skip (I can't listen now)", () => {
  it("is not a mistake: the item stays pending and is asked another way at once", () => {
    let q = createQueue([step("listening", "a"), step("multiple_choice", "b")]);
    q = skip(q, "a");
    expect(q.items.a).toMatchObject({ status: "awaiting", misses: 0 });
    expect(pct(q)).toBe("0/2");
    q = next(q, true);
    expect(onScreen(q)).toEqual({ ids: ["a"], kind: "multiple_choice", review: false });
    expect(pct(q)).toBe("0/2");
    q = play(q, "pass");
    expect(pct(q)).toBe("1/2");
  });

  it("is reviewed without audio if the alternative is missed", () => {
    let q = createQueue([step("listening", "a")]);
    q = next(skip(q, "a"), true);
    q = play(q, "miss");
    expect(onScreen(q)).toEqual({ ids: ["a"], kind: "multiple_choice", review: true });
  });

  it("re-asks a review item another way, without counting a miss", () => {
    let q = createQueue([step("listening", "a")]);
    q = play(q, "miss");
    expect(onScreen(q)?.kind).toBe("listening");
    q = next(skip(q, "a"), true);
    expect(onScreen(q)).toEqual({ ids: ["a"], kind: "multiple_choice", review: true });
    expect(q.items.a.misses).toBe(1);
  });

  it("can't be followed by an answer on the same step", () => {
    let q = createQueue([step("listening", "a")]);
    q = answer(skip(q, "a"), "a", "pass");
    expect(pct(q)).toBe("0/1");
  });
});

describe("special answers", () => {
  it("\"I don't know\" is a miss: no progress, and it goes to review", () => {
    // The screen maps dont_know to a miss — the same path as a wrong answer.
    let q = createQueue([step("active_recall", "a")]);
    q = answer(q, "a", "miss");
    expect(pct(q)).toBe("0/1");
    expect(q.review).toEqual(["a"]);
  });
});

describe("final step", () => {
  it("is the item's own exercise, not its intro flashcard", () => {
    let q = createQueue([step("flashcard", "a"), step("multiple_choice", "a")]);
    expect(isFinalFor(q, "a")).toBe(false);
    q = answer(q, "a", "miss");
    expect(q.items.a.misses).toBe(0);
    q = next(q, false);
    expect(isFinalFor(q, "a")).toBe(true);
  });
});

describe("section start and transitions", () => {
  it("is done at once when there is nothing to ask", () => {
    const q = createQueue([]);
    expect(q.current).toBeNull();
    expect(progress(q)).toEqual({ mastered: 0, total: 0 });
    expect(carryOver(q)).toEqual([]);
  });

  it("resumes with mastered items counted and missed ones back in review", () => {
    let q = createQueue([step("multiple_choice", "c")], {
      completed: ["a"],
      review: [{ id: "b", kind: "matching", misses: 1 }],
    });
    expect(pct(q)).toBe("1/3");
    expect(onScreen(q)?.ids).toEqual(["c"]);
    q = play(q, "pass");
    expect(onScreen(q)).toEqual({ ids: ["b"], kind: "multiple_choice", review: true });
  });

  it("goes straight to review when only review items are left", () => {
    const q = createQueue([], { review: [{ id: "b", kind: "active_recall", misses: 1 }] });
    expect(onScreen(q)).toEqual({ ids: ["b"], kind: "active_recall", review: true });
  });

  it("lets an item's own step win over a stale prior entry", () => {
    const q = createQueue([step("multiple_choice", "a")], { completed: ["a"], review: [{ id: "a", kind: "listening", misses: 1 }] });
    expect(q.items.a.status).toBe("awaiting");
    expect(q.review).toEqual([]);
  });
});

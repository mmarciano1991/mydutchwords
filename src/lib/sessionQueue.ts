/* sessionQueue — the order a session asks its words in, and how far along
   it is.

   One state, with three concepts kept apart:
     mastery   an item's status is "completed" once it is answered right.
     attempts  `misses`: how often it was answered wrong (or "I don't know").
     queues    `main` holds the planned steps not yet shown; `review` holds
               the missed items, asked again once the main queue is done.
   Progress is never counted up by hand: it is derived (see `progress`) as
   completed items over all items in the section, so retries can't inflate
   it and it can't go down.

   An item is a word, keyed by its id. Its status is one of:
     awaiting   not answered yet (or only shown an intro flashcard)
     review     missed; waiting in the review queue
     completed  answered right — mastered for this section
     deferred   missed REVIEW_RETRY_LIMIT more times in review; handed on to
                the next session instead of being asked again now

   Review answers are re-asks, not evidence: the screen reports them as
   `review` and the engine logs them ungraded (learningEngine, rule 2).

   Pure and synchronous: no React, no storage, no clock. */
import { REVIEW_RETRY_LIMIT } from "./learningConfig";
import type { ExerciseType, PlannedStep } from "./learningEngine";

export type ItemStatus = "awaiting" | "review" | "completed" | "deferred";

export interface ItemState {
  status: ItemStatus;
  /** Wrong answers in this section, the first one included. */
  misses: number;
  /** How the item is asked when it comes back for review. */
  reviewKind: ExerciseType;
}

export interface QueueStep extends PlannedStep {
  /** Asked again from the review queue. */
  review: boolean;
}

export interface SessionQueue {
  /** The step on screen. Null once both queues are done. */
  current: QueueStep | null;
  /** Planned steps after the current one. */
  main: PlannedStep[];
  /** Item ids waiting for review, in the order they'll be asked. No
   *  duplicates. */
  review: string[];
  items: Record<string, ItemState>;
  /** Items already answered on the current step — an item is never counted
   *  twice for one exercise. */
  answered: string[];
}

/** Items carried in from an earlier sitting of the same session. */
export interface PriorItems {
  completed?: string[];
  review?: { id: string; kind: ExerciseType; misses: number }[];
}

export type Outcome = "pass" | "miss";

/** A Matching grid of one word means nothing, so a missed grid word comes
 *  back on its own as Multiple Choice. */
export function reviewKindFor(kind: ExerciseType): ExerciseType {
  return kind === "matching" ? "multiple_choice" : kind;
}

/** What a word is asked as when its Listening exercise is skipped: the same
 *  recognition, without audio. */
export const LISTENING_ALTERNATIVE: ExerciseType = "multiple_choice";

/** A queue over `steps`, positioned on its first step. Items from `prior`
 *  that have no step of their own keep their state; prior review items are
 *  asked after the main queue. */
export function createQueue(steps: PlannedStep[], prior: PriorItems = {}): SessionQueue {
  const items: Record<string, ItemState> = {};
  // The last step of an item is its own exercise, and sets how it's reviewed.
  for (const s of steps) {
    for (const id of s.wordIds) items[id] = { status: "awaiting", misses: 0, reviewKind: reviewKindFor(s.kind) };
  }
  for (const id of prior.completed ?? []) {
    items[id] ??= { status: "completed", misses: 0, reviewKind: "multiple_choice" };
  }
  const review: string[] = [];
  for (const r of prior.review ?? []) {
    if (items[r.id]) continue;
    items[r.id] = { status: "review", misses: r.misses, reviewKind: reviewKindFor(r.kind) };
    review.push(r.id);
  }
  return advance({ current: null, main: steps, review, items, answered: [] });
}

/** True when this is the item's own exercise rather than an intro in front
 *  of it — only that answer decides its status. */
export function isFinalFor(q: SessionQueue, id: string): boolean {
  if (!q.current?.wordIds.includes(id)) return false;
  return q.current.review || !q.main.some((s) => s.wordIds.includes(id));
}

/** True when `id` can still be answered on the current step. */
function answerable(q: SessionQueue, id: string): boolean {
  if (!isFinalFor(q, id) || q.answered.includes(id)) return false;
  const status = q.items[id]?.status;
  return status === "awaiting" || status === "review";
}

/** One item's answer on the current step. A pass masters it and takes it
 *  off the review queue. A miss puts it at the back of the review queue —
 *  or, past the retry limit, defers it to the next session. Answers on an
 *  intro step, repeats, and items already settled change nothing. */
export function answer(q: SessionQueue, id: string, outcome: Outcome): SessionQueue {
  if (!answerable(q, id)) return q;
  const item = q.items[id];
  const answered = [...q.answered, id];
  const rest = q.review.filter((r) => r !== id);
  if (outcome === "pass") {
    return { ...q, answered, review: rest, items: { ...q.items, [id]: { ...item, status: "completed" } } };
  }
  const misses = item.misses + 1;
  // The first miss sends it to review; REVIEW_RETRY_LIMIT more there and it's deferred.
  const deferred = misses > REVIEW_RETRY_LIMIT;
  return {
    ...q,
    answered,
    review: deferred ? rest : [...rest, id],
    items: { ...q.items, [id]: { ...item, misses, status: deferred ? "deferred" : "review" } },
  };
}

/** The item can't be answered this way right now (Listening, with no way to
 *  listen). That says nothing about knowing it: it stays pending and is
 *  asked as `alternative` straight away, and if it comes back for review,
 *  as that too. */
export function skip(q: SessionQueue, id: string, alternative: ExerciseType = LISTENING_ALTERNATIVE): SessionQueue {
  if (!answerable(q, id)) return q;
  const items = { ...q.items, [id]: { ...q.items[id], reviewKind: alternative } };
  const answered = [...q.answered, id];
  // A review step stays at the head of the review queue and is re-asked.
  if (q.current!.review) return { ...q, items, answered };
  return { ...q, items, answered, main: [{ kind: alternative, wordIds: [id], graded: true }, ...q.main] };
}

/** Moves past the current step. Items it settled with no answer of their
 *  own (a flashcard shown in place of an exercise) take `passed` as theirs. */
export function next(q: SessionQueue, passed: boolean): SessionQueue {
  let settled = q;
  for (const id of q.current?.wordIds ?? []) settled = answer(settled, id, passed ? "pass" : "miss");
  return advance(settled);
}

/** The main queue first, then the review queue; null when both are empty. */
function advance(q: SessionQueue): SessionQueue {
  const [head, ...main] = q.main;
  if (head) return { ...q, current: { ...head, review: false }, main, answered: [] };
  const id = q.review[0];
  if (id !== undefined) {
    const step: QueueStep = { kind: q.items[id].reviewKind, wordIds: [id], graded: false, review: true };
    return { ...q, current: step, answered: [] };
  }
  return { ...q, current: null, answered: [] };
}

/** Mastered unique items over all unique items in the section. */
export function progress(q: SessionQueue): { mastered: number; total: number } {
  const all = Object.values(q.items);
  return { mastered: all.filter((i) => i.status === "completed").length, total: all.length };
}

/** Items to hand on to the next session: the deferred ones, and — when a
 *  session is left part-way — those still waiting for review. */
export function carryOver(q: SessionQueue): string[] {
  return Object.entries(q.items)
    .filter(([, i]) => i.status === "deferred" || i.status === "review")
    .map(([id]) => id);
}

/** What a miss's answer panel says about when the word comes back. */
export function comesBackNote(q: SessionQueue): string | undefined {
  const statuses = (q.current?.wordIds ?? []).map((id) => q.items[id]?.status);
  if (statuses.includes("review")) return "It’ll come back in a moment.";
  if (statuses.includes("deferred")) return "It’ll come back next session.";
  return undefined;
}

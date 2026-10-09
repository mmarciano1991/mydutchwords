/* dailySet — the practice run: one session through a set of words, and
   what the user actually did in it.

   The run is the single source of truth behind the dashboard's practice
   card and the session report. It is written as each answer is given, so a
   session abandoned mid-way resumes exactly where it stopped, and it holds
   the session's exercise plan so the resumed steps are the same ones.

   A session grades each word once: `answers` holds the word's first answer
   in it. A missed word is asked again in the session's review queue
   (lib/sessionQueue) — ungraded, and not recorded here. The session is
   FULL once every word in it has an answer — right, wrong, "almost" and
   "I don't know" all count. A full session is what completes a day.

   Words the review queue couldn't settle are `deferred`: the next session
   asks them alongside its own words.

   A "practice" run is the ungraded round over just-missed words: it may
   ask a word until it's right, changes no schedule, and never completes a
   day.

   (This file used to also draw a fixed "daily set" once per day. Sessions
   are now selected fresh by learningEngine.selectSessionWords each time.)

   Pure and synchronous: no storage, no clock of its own. */
import { dayKey, type ExerciseType, type PlannedStep, type ReviewResult } from "./learningEngine";
import { LISTENING_ALTERNATIVE, type PriorItems } from "./sessionQueue";

export { dayKey };

/** What a run records per word. `seen` is a flashcard shown in place of an
 *  exercise when no exercise was eligible — answered, but not graded.
 *  `skipped` is only found on older runs: a skipped Listening exercise now
 *  leaves the word pending and asks it another way. */
export type RunAnswer = "know" | "dontKnow" | "skipped" | "seen";

export type RunKind = "daily" | "missed" | "practice";

export interface PracticeRun {
  /** Local calendar day the run was started. */
  date: string;
  /** The words this run covers. */
  wordIds: string[];
  /** The answer standing for each word. */
  answers: Record<string, RunAnswer>;
  /** Id shared by every review event of this session. */
  sessionId?: string;
  /** Absent on runs saved before sessions had kinds — read as "daily". */
  kind?: RunKind;
  /** The session's steps, in order. Absent on older runs. */
  plan?: PlannedStep[];
  /** When the last word was answered (ms). Its local day is the day the
   *  session counts for — a session finished after midnight counts for the
   *  day it was finished. */
  completedAt?: number | null;
  /** Words handed on to the next session: missed past the review retry
   *  limit, or still waiting for review when the session was left. */
  deferred?: string[];
}

/** The run-level answer for an exercise result. */
export function runAnswerFor(result: ReviewResult): RunAnswer {
  switch (result) {
    case "correct":
    case "almost":
      return "know";
    case "wrong":
    case "dont_know":
      return "dontKnow";
    case "skipped":
      return "skipped";
    default:
      return "seen";
  }
}

/** A run over `wordIds`, with nothing answered yet. */
export function startRun(
  wordIds: string[],
  now: Date,
  options: { sessionId?: string; kind?: RunKind; plan?: PlannedStep[] } = {}
): PracticeRun {
  return {
    date: dayKey(now),
    wordIds: [...wordIds],
    answers: {},
    sessionId: options.sessionId,
    kind: options.kind ?? "daily",
    plan: options.plan,
    completedAt: null,
  };
}

/** The run with one answer recorded. Pure. An id outside the run is
 *  ignored. Stamps `completedAt` the moment the last word is answered. */
export function recordAnswer(run: PracticeRun, id: string, answer: RunAnswer, now: Date): PracticeRun {
  if (!run.wordIds.includes(id)) return run;
  const answers = { ...run.answers, [id]: answer };
  const complete = run.wordIds.every((w) => w in answers);
  return { ...run, answers, completedAt: run.completedAt ?? (complete ? now.getTime() : null) };
}

/** True when the run is a graded session whose every word was answered. */
export function isFullSession(run: PracticeRun | null): boolean {
  return Boolean(run && run.kind !== "practice" && run.completedAt);
}

/** Drops words that are no longer in the deck, so one deleted mid-run can't
 *  leave the run permanently unfinishable. */
export function pruneRun(run: PracticeRun, keep: (id: string) => boolean): PracticeRun {
  const wordIds = run.wordIds.filter(keep);
  if (wordIds.length === run.wordIds.length) return run;
  const answers: Record<string, RunAnswer> = {};
  for (const id of wordIds) {
    if (id in run.answers) answers[id] = run.answers[id];
  }
  const plan = run.plan
    ?.map((s) => ({ ...s, wordIds: s.wordIds.filter(keep) }))
    .filter((s) => s.wordIds.length > 0);
  const deferred = run.deferred?.filter(keep);
  return { ...run, wordIds, answers, plan, deferred };
}

/** The run with `ids` as the words it hands on to the next session. */
export function deferWords(run: PracticeRun, ids: string[]): PracticeRun {
  const deferred = [...new Set(ids)];
  if (deferred.length === 0 && !run.deferred?.length) return run;
  return { ...run, deferred };
}

/** Where a resumed sitting starts: words answered right are mastered; words
 *  missed go back into review (their review was lost when the session was
 *  left). Built from the run's answers, so the run stays the one record. */
export function priorItems(run: PracticeRun): PriorItems {
  const kindOf = (id: string): ExerciseType =>
    [...(run.plan ?? [])].reverse().find((s) => s.wordIds.includes(id))?.kind ?? "multiple_choice";
  const completed: string[] = [];
  const review: NonNullable<PriorItems["review"]> = [];
  for (const id of run.wordIds) {
    const a = run.answers[id];
    if (a === "know" || a === "seen") completed.push(id);
    else if (a === "dontKnow") review.push({ id, kind: kindOf(id), misses: 1 });
    // An older run's skip: not a mistake, but not known either.
    else if (a === "skipped") review.push({ id, kind: LISTENING_ALTERNATIVE, misses: 0 });
  }
  return { completed, review };
}

/** The steps still to do, holding only words not yet answered — a Matching
 *  grid left half-done resumes with just its unmatched words. */
export function remainingSteps(run: PracticeRun): PlannedStep[] {
  return (run.plan ?? [])
    .map((s) => ({ ...s, wordIds: s.wordIds.filter((id) => !(id in run.answers)) }))
    .filter((s) => s.wordIds.length > 0);
}

/** Where the run stands.
 *  - `ready`    — no run today, or one with nothing answered yet.
 *  - `progress` — started, not finished. Resumable.
 *  - `done`     — every word in the run has an answer. */
export type RunStatus = "ready" | "progress" | "done";

export interface RunProgress {
  status: RunStatus;
  total: number;
  answered: number;
  /** Unanswered words, in run order. */
  remaining: string[];
  /** Answered correctly (or "almost"). */
  knownIds: string[];
  /** Answered wrong or "I don't know". */
  learningIds: string[];
}

const NOTHING: RunProgress = { status: "ready", total: 0, answered: 0, remaining: [], knownIds: [], learningIds: [] };

/** Reads a run's state. A run that neither started nor finished today is
 *  spent and reports as nothing, so yesterday's result is never today's. */
export function runProgress(run: PracticeRun | null, today: string): RunProgress {
  if (!run || run.wordIds.length === 0) return NOTHING;
  const finishedToday = run.completedAt ? dayKey(new Date(run.completedAt)) === today : false;
  if (run.date !== today && !finishedToday) return NOTHING;

  const remaining: string[] = [];
  const knownIds: string[] = [];
  const learningIds: string[] = [];
  for (const id of run.wordIds) {
    const answer = run.answers[id];
    if (!answer) remaining.push(id);
    else if (answer === "know") knownIds.push(id);
    else if (answer === "dontKnow") learningIds.push(id);
  }
  const answered = run.wordIds.length - remaining.length;
  return {
    status: answered === 0 ? "ready" : remaining.length === 0 ? "done" : "progress",
    total: run.wordIds.length,
    answered,
    remaining,
    knownIds,
    learningIds,
  };
}

/** How many answers a run holds — the tie-break when two devices each have a
 *  run for the same day (see cloudState). */
export function runAnswerCount(run: PracticeRun): number {
  return run.wordIds.filter((id) => id in run.answers).length;
}

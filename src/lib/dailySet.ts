/* dailySet — the day's batch of flashcards, and the run through it.

   Two separate pieces of state, because they answer two different questions:

   - `DailySet` — *which* words today is about. Drawn on the first visit of a
     local calendar day and then left alone, so leaving half-way and coming
     back resumes the same words instead of re-deriving a different list from
     a schedule the earlier answers have already moved.

   - `PracticeRun` — *what the user actually did*. One run through a list of
     words: the day's set, or a re-drill of part of it. It is the single
     source of truth behind the dashboard's practice card, and it is written
     as each answer is given, so the card can never disagree with what was
     answered, and a run abandoned mid-card resumes exactly where it stopped.

   The run is deliberately NOT derived from the practice log. The log is the
   scheduler's history — append-only, one row per graded answer, with no
   notion of a session — so it cannot tell "started a re-drill and stopped"
   apart from "finished the set", and it cannot be reset when a new run
   begins. Deriving the card from it is what let a finished set keep
   reporting an old result after a re-drill had gone badly.

   Pure and synchronous: no storage, no clock of its own. */
import { buildSession, type Grade, type Word } from "./learningEngine";

/** Words drawn per day. */
export const DAILY_SET_SIZE = 16;

export interface DailySet {
  /** Local calendar day the set was drawn for, as YYYY-MM-DD. */
  date: string;
  /** The day's words, in the order they should be practised. */
  wordIds: string[];
}

export interface PracticeRun {
  /** Local calendar day the run belongs to. Runs do not outlive their day. */
  date: string;
  /** The words this run covers, in order. */
  wordIds: string[];
  /** The answer standing for each word. Re-answering a word within a run
   *  replaces its entry, so this is always the run's latest word on it. */
  answers: Record<string, Grade>;
}

/** Local calendar day as YYYY-MM-DD. Deliberately local, not UTC: a set
 *  drawn at 23:00 belongs to that evening, not to the next morning. Zero
 *  padded because this string is persisted and compared as a string. */
export function dayKey(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Draws the day's set. Selection only — nothing is graded.
 *
 *  Three passes, in priority order:
 *    1. due reviews, leeches leading then most overdue (the scheduler's own
 *       ordering, via `buildSession`, widened to the daily size — the set is
 *       bounded by a word count, not a time budget, so the minute budget is
 *       set out of the way rather than left to cap it);
 *    2. new words;
 *    3. whatever is closest to coming back, to fill the set out.
 *
 *  That third pass is what makes this a *daily volume* rather than a strict
 *  spaced-repetition queue: a deck whose reviews all fall next week still
 *  gets a full set to practise today, pulled forward from the front of the
 *  schedule. Without it a returning user is handed an empty set and no way
 *  to reach the day's result at all. */
export function buildDailySet(words: Word[], now: Date, size = DAILY_SET_SIZE): DailySet {
  const scheduled = buildSession(words, now, {
    maxHardCap: size,
    maxNewWordsPerSession: size,
    maxSessionMinutes: 60,
  });

  const taken = new Set(scheduled.map((w) => w.id));
  const topUp = words
    .filter((w) => !taken.has(w.id))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, Math.max(0, size - scheduled.length));

  return { date: dayKey(now), wordIds: [...scheduled, ...topUp].map((w) => w.id) };
}

/** A run over `wordIds`, with nothing answered yet. Starting a run always
 *  goes through here, so a new run can never inherit the previous one's
 *  answers or its result. */
export function startRun(wordIds: string[], now: Date): PracticeRun {
  return { date: dayKey(now), wordIds: [...wordIds], answers: {} };
}

/** The run with one answer recorded. Pure — returns a new run.
 *  An id outside the run is ignored rather than silently widening it. */
export function recordAnswer(run: PracticeRun, id: string, grade: Grade): PracticeRun {
  if (!run.wordIds.includes(id)) return run;
  return { ...run, answers: { ...run.answers, [id]: grade } };
}

/** Drops words that are no longer in the deck, so one deleted mid-run can't
 *  leave the run permanently unfinishable. */
export function pruneRun(run: PracticeRun, keep: (id: string) => boolean): PracticeRun {
  const wordIds = run.wordIds.filter(keep);
  if (wordIds.length === run.wordIds.length) return run;
  const answers: Record<string, Grade> = {};
  for (const id of wordIds) {
    if (id in run.answers) answers[id] = run.answers[id];
  }
  return { ...run, wordIds, answers };
}

/** Where the run stands.
 *  - `ready`    — no run today, or one with nothing answered yet.
 *  - `progress` — started, not finished. Resumable.
 *  - `done`     — every word in the run has an answer. */
export type RunStatus = "ready" | "progress" | "done";

export interface RunProgress {
  status: RunStatus;
  /** Words in the run. */
  total: number;
  /** How many have been answered. */
  answered: number;
  /** The unanswered ones, in run order — exactly what "Continue" resumes. */
  remaining: string[];
  /** Answered "I knew it". */
  knownIds: string[];
  /** Answered "Still learning". */
  learningIds: string[];
}

const NOTHING: RunProgress = {
  status: "ready",
  total: 0,
  answered: 0,
  remaining: [],
  knownIds: [],
  learningIds: [],
};

/** Reads a run's state. A run from an earlier day is spent: it reports as
 *  nothing, so yesterday's result can never be shown as today's. */
export function runProgress(run: PracticeRun | null, today: string): RunProgress {
  if (!run || run.date !== today || run.wordIds.length === 0) return NOTHING;

  const remaining: string[] = [];
  const knownIds: string[] = [];
  const learningIds: string[] = [];
  for (const id of run.wordIds) {
    const grade = run.answers[id];
    if (!grade) remaining.push(id);
    else if (grade === "know") knownIds.push(id);
    else learningIds.push(id);
  }

  const answered = knownIds.length + learningIds.length;
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

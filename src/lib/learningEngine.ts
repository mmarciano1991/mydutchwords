/* ──────────────────────────────────────────────────────────────────────────
   learningEngine — simplified SM-2 spaced-repetition core.

   Pure, synchronous, framework-agnostic: no UI, no storage, no I/O, no
   system-clock calls. Every function takes the data (and "now", where
   relevant) as arguments and returns new data. Safe to unit test in
   isolation and wire into the app's storage/UI layers separately.
   ────────────────────────────────────────────────────────────────────────── */

export type CardState = "new" | "learning" | "mature";

export interface Word {
  id: string;
  // ...other app fields (translation, gender, context, etc.) — not in scope here

  // Spaced repetition state
  interval: number; // days until next due date
  ease: number; // ease factor, starts at 2.5
  reps: number; // consecutive successful (non-"I don't know") reviews
  dueDate: string; // ISO date string
  lapses: number; // total times graded "I don't know" — used for leech detection
  state: CardState;
  lastReviewedAt: string | null;
}

export type Grade = "dontKnow" | "hard" | "easy";

const MIN_EASE = 1.3;
const MATURE_INTERVAL_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, ease);
}

function stateFor(interval: number): CardState {
  return interval >= MATURE_INTERVAL_DAYS ? "mature" : "learning";
}

/**
 * Applies a single SM-2 grade to a word, returning a new word with updated
 * spaced-repetition state. Pure: same inputs always produce the same output.
 */
export function applyGrade(word: Word, grade: Grade, reviewedAt: Date): Word {
  let reps = word.reps;
  let interval = word.interval;
  let ease = word.ease;
  let lapses = word.lapses;

  if (grade === "dontKnow") {
    reps = 0;
    interval = 1;
    ease = clampEase(word.ease - 0.2);
    lapses = word.lapses + 1;
  } else if (grade === "hard") {
    interval = Math.max(1, Math.ceil(word.interval * 1.2));
    ease = clampEase(word.ease - 0.05);
  } else {
    // easy
    reps = word.reps + 1;
    if (reps === 1) {
      interval = 1;
    } else if (reps === 2) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(word.interval * word.ease));
    }
    ease = word.ease + 0.1;
  }

  return {
    ...word,
    reps,
    interval,
    ease,
    lapses,
    dueDate: addDays(reviewedAt, interval).toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    state: stateFor(interval),
  };
}

const LEECH_LAPSE_THRESHOLD = 4;

/** True once a word has been graded "I don't know" 4+ times. Pure derived check. */
export function isLeech(word: Word): boolean {
  return word.lapses >= LEECH_LAPSE_THRESHOLD;
}

export interface SessionConfig {
  maxNewWordsPerSession?: number; // default 10
  maxSessionMinutes?: number; // default 8
  maxHardCap?: number; // default 25 — hard ceiling on total cards regardless of time
  secondsPerCard?: number; // default 12 — used to estimate time budget
}

interface ResolvedSessionConfig {
  maxNewWordsPerSession: number;
  maxSessionMinutes: number;
  maxHardCap: number;
  secondsPerCard: number;
}

const DEFAULT_CONFIG: ResolvedSessionConfig = {
  maxNewWordsPerSession: 10,
  maxSessionMinutes: 8,
  maxHardCap: 25,
  secondsPerCard: 12,
};

function resolveConfig(config?: SessionConfig): ResolvedSessionConfig {
  return { ...DEFAULT_CONFIG, ...config };
}

/** Selects due reviews from `words` (state !== "new", dueDate <= now). */
function dueReviews(words: Word[], now: Date): Word[] {
  return words.filter((w) => w.state !== "new" && new Date(w.dueDate).getTime() <= now.getTime());
}

/** Selects new words from `words`, preserving caller order. */
function newWords(words: Word[]): Word[] {
  return words.filter((w) => w.state === "new");
}

/**
 * Fills a session list (due reviews first, then up to `maxNewWordsPerSession`
 * new words) and trims it to the time budget / hard cap. If due reviews alone
 * exceed the cap, only the capped due reviews are returned.
 */
function fillSession(due: Word[], fresh: Word[], config: ResolvedSessionConfig): Word[] {
  const timeBudgetCards = Math.floor((config.maxSessionMinutes * 60) / config.secondsPerCard);
  const cap = Math.min(config.maxHardCap, timeBudgetCards);

  const cards: Word[] = due.slice(0, cap);
  if (cards.length >= cap) return cards;

  const remaining = cap - cards.length;
  const newSlice = fresh.slice(0, Math.min(remaining, config.maxNewWordsPerSession));
  return [...cards, ...newSlice];
}

/**
 * Builds a practice session from `allWords`: all due reviews first, then new
 * words (in the order given) up to `maxNewWordsPerSession`, capped overall by
 * whichever of the time budget or `maxHardCap` is reached first. Selection
 * only — does not mutate or grade anything.
 */
export function buildSession(allWords: Word[], now: Date, config?: SessionConfig): Word[] {
  const resolved = resolveConfig(config);
  const due = dueReviews(allWords, now);
  const fresh = newWords(allWords);
  return fillSession(due, fresh, resolved);
}

/** Skips the normal ramp for a word the user already knows at capture time. */
export function markAsKnown(word: Word, now: Date): Word {
  return {
    ...word,
    interval: 90,
    ease: 2.5,
    reps: 2,
    dueDate: addDays(now, 90).toISOString(),
    state: "mature",
  };
}

export interface ReviewedCard {
  word: Word; // the post-grade word (after applyGrade was called)
  grade: Grade;
}

export interface SessionReport {
  totalReviewed: number;
  knownCount: number; // graded "hard" or "easy"
  dontKnowWords: Word[]; // words graded "dontKnow" this session, in review order
}

/** Pure summary of a completed session's graded cards. Does not re-grade or mutate. */
export function buildSessionReport(reviewedCards: ReviewedCard[]): SessionReport {
  let knownCount = 0;
  const dontKnowWords: Word[] = [];
  for (const card of reviewedCards) {
    if (card.grade === "dontKnow") {
      dontKnowWords.push(card.word);
    } else {
      knownCount++;
    }
  }
  return {
    totalReviewed: reviewedCards.length,
    knownCount,
    dontKnowWords,
  };
}

/** Re-studies the "I don't know" words from a session report. */
export function buildRestudySession(report: SessionReport, config?: SessionConfig): Word[] {
  const resolved = resolveConfig(config);
  return fillSession(report.dontKnowWords, [], resolved);
}

/**
 * Same selection as `buildSession` (due reviews first, then new words,
 * capped at `maxHardCap`), excluding words already covered earlier in this
 * study run. `allWords` stays the full, uncapped list.
 */
export function buildNextSession(
  allWords: Word[],
  reviewedWordIds: string[],
  now: Date,
  config?: SessionConfig
): Word[] {
  const reviewed = new Set(reviewedWordIds);
  const remaining = allWords.filter((w) => !reviewed.has(w.id));
  return buildSession(remaining, now, config);
}

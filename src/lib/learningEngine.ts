/* ──────────────────────────────────────────────────────────────────────────
   learningEngine — level-ladder spaced repetition.

   Per the product flowchart: every word sits on a level 0–6. A correct
   answer moves it up one level; a wrong answer moves it down one (min 0)
   and counts a lapse. The next review is scheduled at the level's fixed
   interval on the ladder 1 → 3 → 7 → 14 → 30 → 90 days.

   Pure, synchronous, framework-agnostic: no UI, no storage, no I/O, no
   system-clock calls. Every function takes the data (and "now", where
   relevant) as arguments and returns new data.
   ────────────────────────────────────────────────────────────────────────── */

export type CardState = "new" | "learning" | "mature";

/** Days until the next review, per level. Level 0 has no ladder entry:
 *  a level-0 word is (re)learning and comes back after 1 day. */
export const LADDER = [1, 3, 7, 14, 30, 90] as const;
export const MAX_LEVEL = LADDER.length; // 6

export interface Word {
  id: string;
  // ...other app fields (translation, gender, context, etc.) — not in scope here

  // Spaced repetition state
  level: number; // 0 (new / relearning) … MAX_LEVEL (mature)
  interval: number; // days until next due date (derived from level)
  reps: number; // consecutive successful reviews
  dueDate: string; // ISO date string
  lapses: number; // total times answered "I don't know" — used for leech detection
  state: CardState;
  lastReviewedAt: string | null;
}

export type Grade = "know" | "dontKnow";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `days` after `date`, normalized to LOCAL start-of-day. Reviews unlock at
 *  midnight, so "due today" is a calendar concept — a word reviewed at 23:00
 *  is due tomorrow morning, not tomorrow at 23:00. */
function dueDateAfter(date: Date, days: number): Date {
  const d = new Date(date.getTime() + days * MS_PER_DAY);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Fixed review interval (days) for a level. Level 0 → 1 day. */
export function intervalForLevel(level: number): number {
  if (level <= 0) return 1;
  return LADDER[Math.min(level, MAX_LEVEL) - 1];
}

function stateFor(level: number): CardState {
  return level >= MAX_LEVEL ? "mature" : "learning";
}

/**
 * Applies a binary grade to a word, returning a new word with updated
 * ladder state. Pure: same inputs always produce the same output.
 */
export function applyGrade(word: Word, grade: Grade, reviewedAt: Date): Word {
  let level = word.level;
  let reps = word.reps;
  let lapses = word.lapses;

  if (grade === "know") {
    level = Math.min(MAX_LEVEL, level + 1);
    reps = word.reps + 1;
  } else {
    level = Math.max(0, level - 1);
    reps = 0;
    lapses = word.lapses + 1;
  }

  const interval = intervalForLevel(level);
  return {
    ...word,
    level,
    reps,
    lapses,
    interval,
    dueDate: dueDateAfter(reviewedAt, interval).toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    state: stateFor(level),
  };
}

const LEECH_LAPSE_THRESHOLD = 4;

/** True once a word has been answered "I don't know" 4+ times. Pure derived check. */
export function isLeech(word: Word): boolean {
  return word.lapses >= LEECH_LAPSE_THRESHOLD;
}

export interface SessionConfig {
  maxNewWordsPerSession?: number; // default 10
  maxSessionMinutes?: number; // default 8
  maxHardCap?: number; // default 15 — hard ceiling on total cards regardless of time
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
  maxHardCap: 15,
  secondsPerCard: 12,
};

export const SESSION_CAP = DEFAULT_CONFIG.maxHardCap;

function resolveConfig(config?: SessionConfig): ResolvedSessionConfig {
  return { ...DEFAULT_CONFIG, ...config };
}

/** Due reviews from `words` (state !== "new", dueDate <= now).
 *  Leeches (4+ lapses) lead — the report's "coming back sooner" promise —
 *  then most overdue first. */
function dueReviews(words: Word[], now: Date): Word[] {
  return words
    .filter((w) => w.state !== "new" && new Date(w.dueDate).getTime() <= now.getTime())
    .sort((a, b) => {
      const leechDelta = Number(isLeech(b)) - Number(isLeech(a));
      if (leechDelta !== 0) return leechDelta;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
}

/** New words from `words`, preserving caller order. */
function newWords(words: Word[]): Word[] {
  return words.filter((w) => w.state === "new");
}

/**
 * Fills a session list (due reviews first — most overdue leading — then up to
 * `maxNewWordsPerSession` new words) and trims it to the time budget / hard
 * cap. If due reviews alone exceed the cap, only the capped due reviews are
 * returned.
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
 * Builds a practice session from `allWords`: overdue/due reviews first, then
 * new words (in the order given) up to `maxNewWordsPerSession`, capped overall
 * by whichever of the time budget or `maxHardCap` is reached first. Selection
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
    level: MAX_LEVEL,
    interval: intervalForLevel(MAX_LEVEL),
    reps: 2,
    dueDate: dueDateAfter(now, intervalForLevel(MAX_LEVEL)).toISOString(),
    state: "mature",
  };
}

export interface ReviewedCard {
  word: Word; // the post-grade word (after applyGrade was called)
  grade: Grade;
}

export interface SessionReport {
  totalReviewed: number;
  knownCount: number; // answered "know"
  dontKnowWords: Word[]; // words answered "dontKnow" this session, in review order
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

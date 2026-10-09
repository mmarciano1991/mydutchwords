/* ──────────────────────────────────────────────────────────────────────────
   learningEngine — the one place learning rules live.

   Every word carries its own learning state (the `Word` fields below — the
   single source of truth). This module decides how an answer changes that
   state, which words a session asks about, and which exercise each word
   gets. Screens call it; they don't contain learning rules.

   The rules it enforces (see LEARNING_ENGINE_PLAN.md):
     1. No same-session re-grading — a session grades each word once. A
        missed word is asked again in the session's review queue
        (lib/sessionQueue), but those re-asks are logged ungraded.
     2. One graded result per word per local calendar day. Later answers that
        day are logged, but change nothing.
     3. A failed word is due again the next calendar day at the earliest.
     4. Flashcards are exposure, not evidence.
     5. Learned needs spaced evidence: correct answers on several distinct
        days, at least one of them a production, and a long-enough interval.

   Pure, synchronous, framework-agnostic: no UI, no storage, no I/O, no
   system clock. Every function takes `now` (and, where it shuffles, a
   random source) as arguments, so tests can simulate days and weeks.
   Every tunable number is in ./learningConfig.
   ────────────────────────────────────────────────────────────────────────── */
import {
  EASE_GAIN_PRODUCTION,
  EASE_PENALTY_DONT_KNOW,
  EASE_PENALTY_WRONG,
  FAILURES_BEFORE_RESET,
  INITIAL_EASE,
  INTERVAL_MULTIPLIER,
  LEARNED_MIN_INTERVAL_DAYS,
  LEARNED_MIN_SUCCESS_DAYS,
  MATCHING_MAX_WORDS,
  MATCHING_MIN_WORDS,
  MAX_EASE,
  MAX_INTERVAL_DAYS,
  MAX_NEW_WORDS_PER_SESSION,
  MC_MIN_OTHER_WORDS,
  MIN_EASE,
  RESET_INTERVAL_DAYS,
  TIER3_ACTIVE_RECALL_SHARE,
} from "./learningConfig";

// ── Types ──

/** The three states a learner ever sees. */
export type LearningState = "new" | "learning" | "learned";

/** Kept as an alias: older modules still name the state type this way. */
export type CardState = LearningState;

export type ExerciseType =
  | "flashcard"
  | "multiple_choice"
  | "matching"
  | "listening"
  | "sentence_completion"
  | "active_recall";

/** What happened on one exercise. `correct`, `almost`, `wrong` and
 *  `dont_know` are graded answers; `skipped` (Listening only) and `exposure`
 *  (flashcards) never change a word's schedule. */
export type ReviewResult = "correct" | "almost" | "wrong" | "dont_know" | "skipped" | "exposure";

/** Internal measure of how strong the evidence for a word is. Drives which
 *  exercises it gets; never shown to the learner.
 *    0  never graded             → flashcard intro, then recognition
 *    1  recognition proven       → Multiple Choice, Matching, Listening
 *    2  context proven           → Sentence Completion, Active Recall
 *    3  production proven        → mostly Active Recall */
export type EvidenceTier = 0 | 1 | 2 | 3;

/** Version stamped on a word once it has been migrated to this engine. */
export const ENGINE_VERSION = 2;

/** The legacy ladder, kept only so `level` can still be derived for old
 *  readers (the mastery bar, the SQL progress view, a rolled-back client). */
export const LADDER = [1, 3, 7, 14, 30, 90] as const;
export const MAX_LEVEL = LADDER.length; // 6

/** The pre-migration values of a word, frozen at migration time so the
 *  change can be rolled back. Never written again. */
export interface LegacyProgress {
  level: number;
  interval: number;
  reps: number;
  lapses: number;
  state: string;
  dueDate: string;
}

export interface Word {
  id: string;

  /** Engine version this record was written by. */
  engineVersion: number;
  state: LearningState;
  /** Days from the last graded review to the next one. 0 while New. */
  interval: number;
  ease: number;
  /** Next review, ISO, always a local midnight. */
  dueDate: string;
  /** Last GRADED answer, ISO. Exposure and skips don't touch it. */
  lastReviewedAt: string | null;
  /** Local calendar day (YYYY-MM-DD) of the last graded answer. */
  lastGradedDay: string | null;
  /** Correct graded answers in a row. */
  reps: number;
  /** Failures after the word had reached Learning or Learned. Also drives
   *  the "Tricky" tag (see isLeech). */
  lapses: number;
  /** Failed graded answers in a row. */
  consecutiveFailures: number;
  /** Distinct local days with a correct graded answer. */
  successfulReviewDays: number;
  /** Ever answered correctly by producing it (Active Recall or Sentence
   *  Completion). */
  hasProductionSuccess: boolean;
  evidenceTier: EvidenceTier;
  lastExerciseType: ExerciseType | null;
  /** Result of the last graded answer — what "Missed last time" reads. */
  lastResult: ReviewResult | null;
  /** The last Listening exercise was skipped: the next exercise for this
   *  word must not be Listening. Cleared by the next graded answer. */
  listeningSkipped: boolean;

  /** Derived from the state above for old readers. Not used for decisions. */
  level: number;
  legacy?: LegacyProgress;
}

/** Old two-value grade, still what the compact `results` log stores. */
export type Grade = "know" | "dontKnow";

// ── Calendar ──

/** Local calendar day as YYYY-MM-DD. Deliberately local, not UTC: an answer
 *  at 23:00 belongs to that evening. Zero padded so it compares as a string. */
export function dayKey(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Local midnight `days` calendar days after `date`. Steps the calendar
 *  rather than adding 24h — DST days are 23 or 25 hours long. */
function midnightAfter(date: Date, days: number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole calendar days from one YYYY-MM-DD to another. */
export function calendarDaysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function dueTime(w: Pick<Word, "dueDate">): number {
  return new Date(w.dueDate).getTime();
}

function isDue(w: Pick<Word, "dueDate">, now: Date): boolean {
  return dueTime(w) <= now.getTime();
}

function gradedToday(w: Pick<Word, "lastGradedDay">, now: Date): boolean {
  return w.lastGradedDay === dayKey(now);
}

function failedLast(w: Pick<Word, "lastResult">): boolean {
  return w.lastResult === "wrong" || w.lastResult === "dont_know";
}

// ── Exercises: kinds of evidence ──

export type EvidenceKind = keyof typeof INTERVAL_MULTIPLIER;

/** What kind of evidence a correct answer on each exercise is. Flashcards
 *  are absent on purpose: they are never evidence. */
const EVIDENCE: Record<Exclude<ExerciseType, "flashcard">, EvidenceKind> = {
  multiple_choice: "recognition",
  matching: "recognition",
  listening: "recognition",
  sentence_completion: "contextual",
  active_recall: "production",
};

/** Exercises that prove the learner can produce the word. */
const PRODUCTION_EXERCISES: ReadonlySet<ExerciseType> = new Set(["active_recall", "sentence_completion"]);

/** The evidence tier an exercise demonstrates: recognition proves tier 1,
 *  context and production prove tier 2 (and so can lift a word to 3). */
function exerciseTier(type: ExerciseType): number {
  if (type === "flashcard") return -1;
  return EVIDENCE[type] === "recognition" ? 1 : 2;
}

/** Exercises allowed per evidence tier. Tier 0 also gets a flashcard intro
 *  (see planExercises). */
export const TIER_EXERCISES: Record<EvidenceTier, ExerciseType[]> = {
  0: ["multiple_choice", "matching", "listening"],
  1: ["multiple_choice", "matching", "listening"],
  2: ["sentence_completion", "active_recall"],
  3: ["active_recall", "sentence_completion"],
};

// ── Words ──

/** A freshly captured word: New, never graded, due immediately. */
export function newWord(id: string, now: Date): Word {
  return {
    id,
    engineVersion: ENGINE_VERSION,
    state: "new",
    interval: 0,
    ease: INITIAL_EASE,
    dueDate: now.toISOString(),
    lastReviewedAt: null,
    lastGradedDay: null,
    reps: 0,
    lapses: 0,
    consecutiveFailures: 0,
    successfulReviewDays: 0,
    hasProductionSuccess: false,
    evidenceTier: 0,
    lastExerciseType: null,
    lastResult: null,
    listeningSkipped: false,
    level: 0,
  };
}

/** Nearest legacy ladder level at or below an interval. */
export function levelFromInterval(interval: number): number {
  for (let i = LADDER.length - 1; i >= 0; i--) {
    if (interval >= LADDER[i]) return i + 1;
  }
  return 0;
}

/** The legacy 0–6 level for a word's current state: 0 New, 6 Learned, and
 *  1–5 by interval while Learning. Display/compat only. */
export function legacyLevel(w: Pick<Word, "state" | "interval">): number {
  if (w.state === "new") return 0;
  if (w.state === "learned") return MAX_LEVEL;
  return Math.max(1, Math.min(MAX_LEVEL - 1, levelFromInterval(w.interval)));
}

const LEECH_LAPSE_THRESHOLD = 4;

/** True once a word has lapsed 4+ times — shown as "Tricky". */
export function isLeech(word: Pick<Word, "lapses">): boolean {
  return word.lapses >= LEECH_LAPSE_THRESHOLD;
}

// ── Grading ──

export interface AnswerInput {
  exerciseType: ExerciseType;
  result: ReviewResult;
  responseTimeMs?: number | null;
  sessionId?: string | null;
  /** A practice round (re-going over missed words): logged, never graded. */
  practice?: boolean;
}

/** One row of the review log, before it is given an id and a user. */
export interface ReviewEventDraft {
  wordId: string;
  sessionId: string | null;
  /** ISO timestamp of the answer. */
  timestamp: string;
  /** Local calendar day of the answer. */
  localDate: string;
  exerciseType: ExerciseType;
  result: ReviewResult;
  /** Whether this answer changed scheduling (the day's first graded one). */
  graded: boolean;
  responseTimeMs: number | null;
  stateBefore: LearningState;
  stateAfter: LearningState;
  intervalBefore: number;
  intervalAfter: number;
}

export interface GradeOutcome {
  word: Word;
  event: ReviewEventDraft;
  /** True when this answer changed the word's schedule. */
  graded: boolean;
}

function isGradedResult(result: ReviewResult): boolean {
  return result === "correct" || result === "almost" || result === "wrong" || result === "dont_know";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Interval earned by a correct answer on a Learning or Learned word.
 *
 *  Based on the ACTUAL time since the last graded review, so a review taken
 *  early (pulled forward to fill a session) earns little, and one taken late
 *  earns more. Deviation from the spec's `max(elapsed, interval)`: taking
 *  the max would give an early review exactly the on-time interval, which
 *  contradicts the spec's own intent and its "early review earns a smaller
 *  interval" test. The floor `interval + 1` still guarantees growth. */
function nextInterval(word: Word, kind: EvidenceKind, now: Date): number {
  const elapsed = word.lastReviewedAt
    ? Math.max(0, calendarDaysBetween(dayKey(new Date(word.lastReviewedAt)), dayKey(now)))
    : word.interval;
  const raw = Math.round(elapsed * INTERVAL_MULTIPLIER[kind] * (word.ease / INITIAL_EASE));
  return Math.min(MAX_INTERVAL_DAYS, Math.max(word.interval + 1, raw));
}

/**
 * Applies one answer to a word. Pure: returns the new word, the log row, and
 * whether the answer was graded.
 *
 * Only the first graded answer of a local day changes anything. Flashcards,
 * skips, practice rounds and repeat answers on the same day come back with
 * the word unchanged (a skip only marks Listening as off-limits next time).
 */
export function gradeWord(word: Word, input: AnswerInput, now: Date): GradeOutcome {
  const { exerciseType, result } = input;
  const today = dayKey(now);
  const before = word;

  const graded =
    !input.practice &&
    exerciseType !== "flashcard" &&
    isGradedResult(result) &&
    word.lastGradedDay !== today;

  let next: Word = word;

  if (!graded) {
    if (result === "skipped" && exerciseType === "listening" && !input.practice) {
      next = { ...word, listeningSkipped: true };
    }
  } else if (result === "correct" || result === "almost") {
    next = applyCorrect(word, exerciseType, result, now);
  } else {
    next = applyFailure(word, result as "wrong" | "dont_know", now);
  }

  if (graded) {
    next = {
      ...next,
      lastReviewedAt: now.toISOString(),
      lastGradedDay: today,
      lastExerciseType: exerciseType,
      lastResult: result,
      listeningSkipped: false,
    };
    next.level = legacyLevel(next);
  }

  return {
    word: next,
    graded,
    event: {
      wordId: word.id,
      sessionId: input.sessionId ?? null,
      timestamp: now.toISOString(),
      localDate: today,
      exerciseType,
      result,
      graded,
      responseTimeMs: input.responseTimeMs ?? null,
      stateBefore: before.state,
      stateAfter: next.state,
      intervalBefore: before.interval,
      intervalAfter: next.interval,
    },
  };
}

function applyCorrect(word: Word, type: ExerciseType, result: "correct" | "almost", now: Date): Word {
  const kind: EvidenceKind = result === "almost" ? "recognition" : EVIDENCE[type as keyof typeof EVIDENCE];
  const production = PRODUCTION_EXERCISES.has(type);
  const tierUp = exerciseTier(type) >= word.evidenceTier ? 1 : 0;
  const evidenceTier = Math.min(3, word.evidenceTier + tierUp) as EvidenceTier;
  const common = {
    reps: word.reps + 1,
    consecutiveFailures: 0,
    successfulReviewDays: word.successfulReviewDays + 1,
    hasProductionSuccess: word.hasProductionSuccess || production,
    evidenceTier,
  };

  // New → Learning on the first correct graded answer. Learning here only
  // means "recognised"; the real evidence comes on later days.
  if (word.state === "new") {
    return {
      ...word,
      ...common,
      state: "learning",
      interval: RESET_INTERVAL_DAYS,
      ease: INITIAL_EASE,
      dueDate: midnightAfter(now, RESET_INTERVAL_DAYS).toISOString(),
    };
  }

  const interval = nextInterval(word, kind, now);
  const ease =
    kind === "production" && result === "correct" ? Math.min(MAX_EASE, round2(word.ease + EASE_GAIN_PRODUCTION)) : word.ease;

  const promoted =
    word.state === "learning" &&
    common.successfulReviewDays >= LEARNED_MIN_SUCCESS_DAYS &&
    common.hasProductionSuccess &&
    interval >= LEARNED_MIN_INTERVAL_DAYS;

  return {
    ...word,
    ...common,
    state: promoted ? "learned" : word.state,
    interval,
    ease,
    dueDate: midnightAfter(now, interval).toISOString(),
  };
}

function applyFailure(word: Word, result: "wrong" | "dont_know", now: Date): Word {
  const penalty = result === "dont_know" ? EASE_PENALTY_DONT_KNOW : EASE_PENALTY_WRONG;
  const consecutiveFailures = word.consecutiveFailures + 1;
  const dueDate = midnightAfter(now, RESET_INTERVAL_DAYS).toISOString();
  const base = {
    reps: 0,
    consecutiveFailures,
    ease: Math.max(MIN_EASE, round2(word.ease - penalty)),
    dueDate,
  };

  // Never recognised yet: stays New, back tomorrow with its flashcard intro.
  if (word.state === "new") {
    return { ...word, ...base, interval: 0, evidenceTier: 0 };
  }

  // Too many misses in a row: reintroduce it from scratch. Spaced evidence
  // gathered earlier (successfulReviewDays, hasProductionSuccess) is kept.
  if (consecutiveFailures >= FAILURES_BEFORE_RESET) {
    return { ...word, ...base, state: "new", interval: 0, evidenceTier: 0, lapses: word.lapses + 1 };
  }

  // Learning stays Learning; Learned drops back to Learning. Not a full
  // reset — earlier evidence is kept, so re-promotion needs fewer days.
  return {
    ...word,
    ...base,
    state: "learning",
    interval: RESET_INTERVAL_DAYS,
    lapses: word.lapses + 1,
    evidenceTier: Math.max(1, word.evidenceTier - 1) as EvidenceTier,
  };
}

// ── Session selection ──

export type SessionKind = "daily" | "missed";

export interface SessionOptions {
  /** Words wanted — the user's session size. */
  size: number;
  kind?: SessionKind;
  /** New words allowed in; defaults to the config cap. */
  maxNewWords?: number;
}

type Selectable = Word & { dateAdded?: number };

/** Words whose last graded answer was a miss, now due again. */
function failedAndDue<T extends Selectable>(words: T[], now: Date): T[] {
  return words.filter((w) => failedLast(w) && isDue(w, now)).sort((a, b) => dueTime(a) - dueTime(b));
}

/**
 * Picks the words for one session, by priority:
 *   1. failed on their last review and now due
 *   2. overdue Learning words, most overdue first
 *   3. Learning words due today
 *   4. Learned words due (today or overdue)
 *   5. New words, oldest captured first, up to the new-word cap
 *   6. if still short: words not due yet, closest to due first
 * Never a word already graded today. A "missed" session is step 1 only.
 *
 * Returns the words in priority order; planExercises shuffles them.
 */
export function selectSessionWords<T extends Selectable>(words: T[], now: Date, options: SessionOptions): T[] {
  const size = Math.max(0, options.size);
  const pool = words.filter((w) => !gradedToday(w, now));
  const failed = failedAndDue(pool, now);
  if (options.kind === "missed") return failed.slice(0, size);

  const startOfToday = midnightAfter(now, 0).getTime();
  const taken = new Set(failed.map((w) => w.id));
  const rest = pool.filter((w) => !taken.has(w.id));

  const learningDue = rest.filter((w) => w.state === "learning" && isDue(w, now)).sort((a, b) => dueTime(a) - dueTime(b));
  const overdue = learningDue.filter((w) => dueTime(w) < startOfToday);
  const dueToday = learningDue.filter((w) => dueTime(w) >= startOfToday);
  const learnedDue = rest.filter((w) => w.state === "learned" && isDue(w, now)).sort((a, b) => dueTime(a) - dueTime(b));

  const maxNew = options.maxNewWords ?? MAX_NEW_WORDS_PER_SESSION;
  const out: T[] = [];
  const push = (list: T[]) => {
    for (const w of list) if (out.length < size) out.push(w);
  };
  // Failed words that are still New count toward the new-word cap too.
  const failedNew = failed.filter((w) => w.state === "new").length;

  push(failed);
  push(overdue);
  push(dueToday);
  push(learnedDue);

  const fresh = rest
    .filter((w) => w.state === "new")
    .sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0))
    .slice(0, Math.max(0, maxNew - failedNew));
  push(fresh);

  if (out.length < size) {
    const chosen = new Set(out.map((w) => w.id));
    const ahead = rest
      .filter((w) => w.state !== "new" && !chosen.has(w.id) && !isDue(w, now))
      .sort((a, b) => dueTime(a) - dueTime(b));
    push(ahead);
  }
  return out;
}

/**
 * Picks the words for a "practise again" round — free, ungraded practice the
 * user can repeat as often as they like, once nothing is left to grade today.
 * Unlike selectSessionWords it may (and prefers to) repeat words already
 * graded today: missed today first, then the rest of today's, then the deck.
 * Shuffled within each group so back-to-back rounds vary.
 */
export function selectReplayWords<T extends Selectable>(words: T[], now: Date, size: number, rng: () => number = Math.random): T[] {
  const shuffle = (list: T[]) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const today = words.filter((w) => gradedToday(w, now));
  const missedToday = today.filter(failedLast);
  const restToday = today.filter((w) => !failedLast(w));
  const others = words.filter((w) => !gradedToday(w, now));
  return [...shuffle(missedToday), ...shuffle(restToday), ...shuffle(others)].slice(0, Math.max(0, size));
}

export interface DueSummary {
  /** Missed last time, and due again. */
  missed: string[];
  /** Learning/Learned words due, last answered correctly. */
  dueForReview: string[];
  /** New words waiting. */
  newWords: string[];
  /** All words per visible state. */
  counts: Record<LearningState, number>;
}

/** The dashboard's review queue. Words graded today are never "due". */
export function dueSummary(words: Word[], now: Date): DueSummary {
  const pool = words.filter((w) => !gradedToday(w, now));
  const missed = failedAndDue(pool, now).map((w) => w.id);
  const missedSet = new Set(missed);
  const counts: Record<LearningState, number> = { new: 0, learning: 0, learned: 0 };
  for (const w of words) counts[w.state]++;
  return {
    missed,
    dueForReview: pool.filter((w) => w.state !== "new" && !missedSet.has(w.id) && isDue(w, now)).map((w) => w.id),
    newWords: pool.filter((w) => w.state === "new" && !missedSet.has(w.id)).map((w) => w.id),
    counts,
  };
}

// ── Exercise planning ──

export interface ExerciseContext {
  /** Words in the user's deck — Multiple Choice needs enough distractors. */
  deckSize: number;
  /** Exercise types the app can currently show. */
  supported: ReadonlySet<ExerciseType>;
  /** The "Audio exercises" setting. */
  audioEnabled: boolean;
  /** Pronunciation audio is available for this word. */
  hasAudio: (wordId: string) => boolean;
  /** The word has a sentence usable for Sentence Completion. */
  hasSentence: (wordId: string) => boolean;
  /** Multiple Choice may top up its distractors from the bundled dictionary
   *  when the deck is too small (see MC_DICTIONARY_FILL_WORDS). */
  fillChoices?: boolean;
}

/** One screen of a session. A Matching step covers several words; every
 *  other step covers one. `graded: false` steps are exposure only: the
 *  tier-0 flashcard intro, and the flashcard fallback. */
export interface PlannedStep {
  kind: ExerciseType;
  wordIds: string[];
  graded: boolean;
}

function eligible(kind: ExerciseType, word: Word, ctx: ExerciseContext): boolean {
  if (!ctx.supported.has(kind)) return false;
  switch (kind) {
    case "multiple_choice":
      return ctx.deckSize - 1 >= MC_MIN_OTHER_WORDS || Boolean(ctx.fillChoices);
    case "listening":
      return ctx.audioEnabled && !word.listeningSkipped && ctx.hasAudio(word.id);
    case "sentence_completion":
      return ctx.hasSentence(word.id);
    default:
      return true;
  }
}

/** The tier a word's next exercise is drawn from: its evidence tier, or one
 *  lower right after a miss. */
export function exerciseTierFor(word: Word): EvidenceTier {
  return (failedLast(word) ? Math.max(0, word.evidenceTier - 1) : word.evidenceTier) as EvidenceTier;
}

/** The graded exercise for one word, or null when nothing is eligible. */
function chooseExercise(word: Word, ctx: ExerciseContext, random: () => number, exclude?: ExerciseType): ExerciseType | null {
  const tier = exerciseTierFor(word);
  const candidates = TIER_EXERCISES[tier].filter((k) => k !== exclude && eligible(k, word, ctx));
  if (candidates.length === 0) {
    return exclude !== "multiple_choice" && eligible("multiple_choice", word, ctx) ? "multiple_choice" : null;
  }
  // Variety, but learning effectiveness first: only among allowed ones.
  const varied = candidates.filter((k) => k !== word.lastExerciseType);
  const pool = varied.length > 0 ? varied : candidates;
  if (tier === 3 && pool.includes("active_recall") && pool.length > 1) {
    return random() < TIER3_ACTIVE_RECALL_SHARE ? "active_recall" : pool.find((k) => k !== "active_recall")!;
  }
  return pool[Math.floor(random() * pool.length)];
}

/** Fisher–Yates, with an injectable random source. */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Plans a session: one graded exercise per word (tier-0 words get a
 * flashcard intro first), Matching words grouped 4–5 to a grid, the order
 * shuffled so failed words aren't bunched at the start, and two steps of
 * the same kind kept apart where possible.
 */
export function planExercises(words: Word[], ctx: ExerciseContext, random: () => number): PlannedStep[] {
  const choice = new Map<string, ExerciseType | null>();
  for (const w of words) choice.set(w.id, chooseExercise(w, ctx, random));

  // Picked word by word, Matching would rarely reach a grid of 4. When the
  // session holds enough recognition-tier words, gather one grid from those
  // that drew Multiple Choice (Listening is kept: it trains something else).
  // Only the minimum grid, so the session keeps some Multiple Choice too.
  const canMatch = (w: Word) =>
    TIER_EXERCISES[exerciseTierFor(w)].includes("matching") && eligible("matching", w, ctx);
  const drewMatching = words.filter((w) => choice.get(w.id) === "matching").length;
  if (drewMatching < MATCHING_MIN_WORDS) {
    const extra = words.filter((w) => choice.get(w.id) === "multiple_choice" && canMatch(w));
    if (drewMatching + extra.length >= MATCHING_MIN_WORDS) {
      const fresh = extra.filter((w) => w.lastExerciseType !== "matching");
      const ranked = [...fresh, ...extra.filter((w) => w.lastExerciseType === "matching")];
      for (const w of ranked.slice(0, MATCHING_MIN_WORDS - drewMatching)) choice.set(w.id, "matching");
    }
  }

  // Matching needs a grid of 4–5. Group what we can; the rest pick again.
  const matching = words.filter((w) => choice.get(w.id) === "matching");
  const groups: string[][] = [];
  const groupCount = Math.floor(matching.length / MATCHING_MIN_WORDS);
  const grouped = Math.min(matching.length, groupCount * MATCHING_MAX_WORDS);
  for (let g = 0; g < groupCount; g++) groups.push([]);
  matching.slice(0, grouped).forEach((w, i) => groups[i % groupCount].push(w.id));
  for (const w of matching.slice(grouped)) choice.set(w.id, chooseExercise(w, ctx, random, "matching"));

  // Units keep a tier-0 intro directly in front of its exercise — for a
  // Matching grid, the intros of every new word on it.
  const byId = new Map(words.map((w) => [w.id, w]));
  const units: PlannedStep[][] = groups.map((ids) => [
    ...ids
      .filter((id) => exerciseTierFor(byId.get(id)!) === 0)
      .map((id): PlannedStep => ({ kind: "flashcard", wordIds: [id], graded: false })),
    { kind: "matching", wordIds: ids, graded: true },
  ]);
  for (const w of words) {
    const kind = choice.get(w.id);
    if (kind === "matching") continue;
    const unit: PlannedStep[] = [];
    if (exerciseTierFor(w) === 0 || kind === null) unit.push({ kind: "flashcard", wordIds: [w.id], graded: false });
    if (kind) unit.push({ kind, wordIds: [w.id], graded: true });
    units.push(unit);
  }

  // Shuffle, then greedily avoid two exercises of the same kind in a row
  // (an intro flashcard in between doesn't count as a break).
  const remaining = shuffle(units, random);
  const ordered: PlannedStep[] = [];
  const kindOf = (u: PlannedStep[]) => u[u.length - 1].kind;
  while (remaining.length > 0) {
    const last = ordered.length > 0 ? ordered[ordered.length - 1].kind : undefined;
    const i = Math.max(0, remaining.findIndex((u) => kindOf(u) !== last));
    ordered.push(...remaining.splice(i, 1)[0]);
  }
  return ordered;
}

// ── Migration ──

/** One row of the compact practice log, as the migration reads it. */
export interface HistoryRow {
  entryId: string;
  grade: Grade;
  timestamp: number;
}

/** A stored word of any earlier shape: the v1 ladder fields, all optional. */
export interface StoredWord {
  id: string;
  engineVersion?: number;
  level?: number;
  interval?: number;
  reps?: number;
  dueDate?: string;
  lapses?: number;
  state?: string;
  lastReviewedAt?: string | null;
}

/** Last gap (in days) between distinct correct days needed before a migrated
 *  word may start as Learned. */
const MIGRATION_LEARNED_MIN_GAP_DAYS = 4;

/**
 * Maps a pre-v2 word onto this engine, conservatively. Idempotent: a word
 * already at ENGINE_VERSION is returned as-is (same object).
 *
 *   - no correct history                  → New
 *   - any correct history                 → Learning, tier 1, interval and
 *                                           due date kept
 *   - correct on ≥3 distinct days, the
 *     last two of them ≥4 days apart      → Learned, tier 3
 *
 * Old "correct" answers may come from same-session re-showing, so the old
 * "mature" state on its own is never enough for Learned. No events are
 * backfilled; counters are derived from the compact log.
 */
export function migrateWord<T extends StoredWord>(raw: T, history: HistoryRow[], now: Date): T & Word {
  if (raw.engineVersion === ENGINE_VERSION) return raw as T & Word;

  const rows = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const knowDays = [...new Set(rows.filter((r) => r.grade === "know").map((r) => dayKey(new Date(r.timestamp))))].sort();
  const hasCorrect = knowDays.length > 0 || (raw.reps ?? 0) > 0;

  let trailingMisses = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i].grade === "dontKnow"; i--) trailingMisses++;
  const last = rows[rows.length - 1];

  const learned =
    knowDays.length >= 3 &&
    calendarDaysBetween(knowDays[knowDays.length - 2], knowDays[knowDays.length - 1]) >= MIGRATION_LEARNED_MIN_GAP_DAYS;

  const state: LearningState = !hasCorrect ? "new" : learned ? "learned" : "learning";
  const interval = state === "new" ? 0 : Math.min(MAX_INTERVAL_DAYS, (raw.interval ?? 0) > 0 ? raw.interval! : RESET_INTERVAL_DAYS);
  const lastReviewedAt = raw.lastReviewedAt ?? (last ? new Date(last.timestamp).toISOString() : null);

  const word: Word = {
    id: raw.id,
    engineVersion: ENGINE_VERSION,
    state,
    interval,
    ease: INITIAL_EASE,
    dueDate: raw.dueDate ?? now.toISOString(),
    lastReviewedAt,
    lastGradedDay: last ? dayKey(new Date(last.timestamp)) : lastReviewedAt ? dayKey(new Date(lastReviewedAt)) : null,
    reps: hasCorrect ? Math.max(0, raw.reps ?? 0) : 0,
    lapses: raw.lapses ?? 0,
    consecutiveFailures: Math.min(FAILURES_BEFORE_RESET - 1, trailingMisses),
    successfulReviewDays: Math.max(knowDays.length, hasCorrect ? 1 : 0),
    hasProductionSuccess: false,
    evidenceTier: state === "new" ? 0 : state === "learned" ? 3 : 1,
    lastExerciseType: null,
    lastResult: last ? (last.grade === "know" ? "correct" : "wrong") : null,
    listeningSkipped: false,
    level: 0,
    legacy: {
      level: raw.level ?? 0,
      interval: raw.interval ?? 0,
      reps: raw.reps ?? 0,
      lapses: raw.lapses ?? 0,
      state: raw.state ?? "new",
      dueDate: raw.dueDate ?? now.toISOString(),
    },
  };
  word.level = legacyLevel(word);
  return { ...raw, ...word };
}

/** Migrates a whole deck against the practice log. Already-migrated words
 *  come back as the same objects, so running it twice changes nothing. */
export function migrateWords<T extends StoredWord>(words: T[], results: HistoryRow[], now: Date): (T & Word)[] {
  const byId = new Map<string, HistoryRow[]>();
  for (const r of results) {
    const list = byId.get(r.entryId);
    if (list) list.push(r);
    else byId.set(r.entryId, [r]);
  }
  return words.map((w) => migrateWord(w, byId.get(w.id) ?? [], now));
}

/** The pre-migration record, for a rollback. Words migrated before `legacy`
 *  existed, or never migrated, come back unchanged. */
export function restoreLegacy<T extends Word>(word: T): T {
  if (!word.legacy) return word;
  const { legacy, ...rest } = word;
  return {
    ...rest,
    engineVersion: 1,
    level: legacy.level,
    interval: legacy.interval,
    reps: legacy.reps,
    lapses: legacy.lapses,
    state: legacy.state,
    dueDate: legacy.dueDate,
  } as unknown as T;
}

/** Maps a graded result onto the compact log's two grades. Exposure and
 *  skips are not graded and have no grade. */
export function toGrade(result: ReviewResult): Grade | null {
  if (result === "correct" || result === "almost") return "know";
  if (result === "wrong" || result === "dont_know") return "dontKnow";
  return null;
}

/* learningConfig — every tunable number the learning engine uses, in one
   place. Nothing else in the app should hard-code an interval, a
   multiplier, a cap or a threshold: change it here and the engine, the
   session builder and the tests all follow.

   See LEARNING_ENGINE_PLAN.md for where each rule comes from. */

// ── Scheduling ──

/** Ease a word starts with when it first becomes Learning. Also the
 *  reference point: at this ease the interval multiplier is applied as-is. */
export const INITIAL_EASE = 2.3;
/** Ease never drops below this, however often a word is missed. */
export const MIN_EASE = 1.3;
/** Ease never rises above this. */
export const MAX_EASE = 3.0;
/** Added to ease on a fully correct production answer (Active Recall).
 *  Recognition, contextual (Sentence Completion) and "almost" answers leave
 *  it alone. */
export const EASE_GAIN_PRODUCTION = 0.05;
/** Taken off ease on a wrong answer. */
export const EASE_PENALTY_WRONG = 0.2;
/** Taken off ease on "I don't know" — a failed retrieval, but an honest one. */
export const EASE_PENALTY_DONT_KNOW = 0.1;

/** Interval multiplier by the kind of evidence an exercise gives. Producing
 *  a word is stronger evidence than picking it out of a list, so it earns
 *  a longer gap. */
export const INTERVAL_MULTIPLIER = {
  recognition: 1.4,
  contextual: 1.8,
  production: 2.3,
} as const;

/** Longest interval the scheduler will ever set, in days. */
export const MAX_INTERVAL_DAYS = 180;
/** Interval set when a word first becomes Learning, and after any miss.
 *  A failed word is due again the next calendar day — never sooner. */
export const RESET_INTERVAL_DAYS = 1;

// ── Learned ──

/** Distinct days with a correct graded answer needed to be Learned. */
export const LEARNED_MIN_SUCCESS_DAYS = 3;
/** The interval just earned must be at least this long to be Learned. */
export const LEARNED_MIN_INTERVAL_DAYS = 7;
/** This many failures in a row sends a word back to New (reintroduced with
 *  a flashcard). */
export const FAILURES_BEFORE_RESET = 3;

// ── Sessions ──

/** New words (never practised, or reset) allowed into the day's first
 *  section scale with how many are waiting: this share of the New backlog,
 *  never fewer than MAX_NEW_WORDS_PER_SESSION and never more than the
 *  section size. 20 waiting → 5; 100 waiting → 10; 200 waiting → 20.
 *  A small backlog keeps the section review-led; a big one drains steadily
 *  instead of 5 a day forever. */
export const NEW_WORDS_SHARE_OF_BACKLOG = 0.1;
/** The floor of that scale — and the whole cap for backlogs under 50 —
 *  so a capture binge doesn't flood a small deck's session. */
export const MAX_NEW_WORDS_PER_SESSION = 5;
/** New words allowed into a follow-on section — any session started after a
 *  word has already been graded today. The day's first section stays
 *  review-led (capped above); once the user chooses to keep going, a section
 *  is filled to its full size, due reviews first and then New words, so
 *  "keep going" is never a 3-word scrap. Capped further by the section size.
 *  The schedule is unaffected: each word still gets one graded answer per
 *  day (rule 2), so extra sections add words, never extra days. */
export const MAX_NEW_WORDS_PER_FOLLOW_ON_SECTION = 30;
/** Default session size, before the user has picked one. */
export const DEFAULT_SESSION_SIZE = 10;

// ── Exercise eligibility ──

/** Options in a Multiple Choice exercise, the answer included. */
export const MC_OPTION_COUNT = 4;
/** Other deck words needed to build Multiple Choice distractors. */
export const MC_MIN_OTHER_WORDS = MC_OPTION_COUNT - 1;
/** When the deck is smaller than that, Multiple Choice tops its
 *  distractors up from the first this-many entries of the bundled
 *  dictionary (the curated ones) — so a learner's very first words can be
 *  recognised, and become Learning, from day one. The user's own words are
 *  always used first. */
export const MC_DICTIONARY_FILL_WORDS = 2000;
/** Words on one Matching grid. */
export const MATCHING_MIN_WORDS = 4;
export const MATCHING_MAX_WORDS = 5;
/** Options in a Listening exercise, the answer included. */
export const LISTENING_OPTION_COUNT = 4;
/** In evidence tier 3, how often Active Recall is picked over Sentence
 *  Completion when both are eligible ("mostly Active Recall"). */
export const TIER3_ACTIVE_RECALL_SHARE = 0.75;

// ── Answer checking ──

/** Answers of at most this many letters allow this many typos; longer
 *  answers allow `TYPO_EDITS_LONG`. Damerau-Levenshtein distance. */
export const TYPO_SHORT_MAX_LETTERS = 6;
export const TYPO_EDITS_SHORT = 1;
export const TYPO_EDITS_LONG = 2;

// ── Review within a session ──

/** Mistakes a missed word may make in the review queue before it is handed
 *  on to the next session, so a word the learner can't get today never
 *  traps them in an endless review loop. */
export const REVIEW_RETRY_LIMIT = 2;

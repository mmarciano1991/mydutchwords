import type { Grade, Word } from "./learningEngine";

/** Dutch grammatical article for nouns; null for non-nouns. */
export type Gender = "de" | "het" | null;

/** A bundled dictionary word (offline, authored). */
export interface DictionaryEntry {
  id: string;
  dutch: string;
  english: string;
  gender: Gender;
  example: string;
  exampleEn: string;
}

/** A word the user has added to their flashcard deck: dictionary entry id +
 *  its spaced-repetition state (see lib/learningEngine). */
export interface DeckItem extends Word {
  dateAdded: number;
}

/** One flashcard answer during a practice session. */
export interface PracticeResult {
  entryId: string;
  grade: Grade;
  timestamp: number;
}

/** How well the user knows a word, derived from successful recalls. */
export type ConfidenceLevel = "weak" | "medium" | "mastering" | "mastered";

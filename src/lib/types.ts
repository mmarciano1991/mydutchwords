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

/** A word the user has added to their flashcard deck (references a dictionary entry). */
export interface DeckItem {
  id: string; // dictionary entry id
  dateAdded: number;
}

/** One flashcard answer during a practice session. */
export interface PracticeResult {
  entryId: string;
  knew: boolean;
  timestamp: number;
}

/** How well the user knows a word, derived from successful recalls. */
export type ConfidenceLevel = "weak" | "medium" | "mastering" | "mastered";

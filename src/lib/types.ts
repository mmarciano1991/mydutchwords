/** Dutch grammatical article for nouns; null for non-nouns / unknown. */
export type Gender = "de" | "het" | null;

export interface Word {
  id: string;
  dutch: string;
  translation: string;
  gender: Gender;
  /** A Dutch example sentence that contains `dutch` (shown on capture; offline exercise fallback). */
  exampleSentence: string;
  dateAdded: number;
}

export interface PracticeResult {
  wordId: string;
  correct: boolean;
  timestamp: number;
}

/** What a dictionary lookup (Claude proxy or offline fallback) returns. */
export interface Lookup {
  translation: string;
  gender: Gender;
  example_sentence: string;
}

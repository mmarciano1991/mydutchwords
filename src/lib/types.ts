export interface Word {
  id: string;
  dutch: string;
  translation: string;
  /** A Dutch example sentence that contains `dutch` (used for fill-in-the-blank). */
  exampleSentence: string;
  dateAdded: number;
}

export interface PracticeResult {
  wordId: string;
  correct: boolean;
  timestamp: number;
}

/** What a lookup (Claude or fallback) returns for a captured word. */
export interface Lookup {
  translation: string;
  example_sentence: string;
}

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
  /** Other meanings of the same word, when more than one is known — e.g.
   *  "aanslag" as a tax assessment vs. an attack. The entry's own
   *  english/example/exampleEn above are always senses[0]: every existing
   *  reader (deck rows, flashcards) that only looks at the top-level fields
   *  keeps working unchanged, and only the capture screen needs to know a
   *  choice exists. Absent (not empty) for the ~14,190 words with one gloss,
   *  so resolving an ordinary word never allocates an array for it. */
  senses?: WordSense[];
  /** The real Dutch sentence this word was actually met in, distinct from
   *  the dictionary's own canonical example above. Set automatically by
   *  "Add from text" (see AddFromText.tsx), where the sentence is
   *  unambiguous — it's whichever one the tapped word came from. A learner
   *  who can compare a gloss against the sentence they personally read it
   *  in can catch a wrong sense the dictionary's own example never would
   *  (see docs/recommendations.md, item 1c). Dutch only — the point is to
   *  recognise it, not translate it again. */
  metIn?: string;
}

/** One meaning of a word — its own translation, example, and article, since
 *  a heteronym can take a different one per sense ("uiterlijk" the adverb
 *  has none; "het uiterlijk" the noun does). */
export interface WordSense {
  english: string;
  example: string;
  exampleEn: string;
  gender: Gender;
  /** Short tag distinguishing this sense at a glance — a part of speech from
   *  the online dictionary, or a hand-authored hint like "tax / municipal".
   *  Optional: most senses are distinguishable by their gloss alone. */
  label?: string;
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

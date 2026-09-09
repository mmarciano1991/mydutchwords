import type { Grade, Word } from "./learningEngine";

/**
 * Dutch grammatical article.
 *
 * The two real articles, plus the two different reasons a word might not
 * show one — which used to be the same value, `null`, and that was the root
 * of the "missing article" problem:
 *
 *   "none"     this word takes no article. Verbs, adjectives, adverbs,
 *              prepositions. Correct, complete, nothing to fix.
 *   "unknown"  nobody has established the article yet. A noun imported from
 *              a word list that didn't carry gender, or an online lookup
 *              whose headword line couldn't be read.
 *
 * Collapsing those two into `null` meant a missing article rendered exactly
 * like a word that never needed one, so the gap was invisible: it couldn't
 * be counted, couldn't be validated, and couldn't be shown to the learner as
 * something the app doesn't know. Splitting them is what makes
 * scripts/validate-dictionary.mjs able to fail a build over it.
 */
export type Gender = "de" | "het" | "none" | "unknown";

/**
 * One meaning of a word — its own translation, example, and article.
 *
 * The sense, not the word, is the unit of meaning here. A heteronym takes a
 * different article per sense ("uiterlijk" the adverb has none; "het
 * uiterlijk" the noun does) and a different example sentence, because a
 * single sentence can only ever demonstrate one meaning — which is why an
 * entry with two meanings and one sentence was silently misrepresenting the
 * second.
 */
export interface WordSense {
  english: string;
  example: string;
  exampleEn: string;
  gender: Gender;
  /** Short tag distinguishing this sense at a glance — a part of speech from
   *  the online dictionary, or a hand-authored hint like "tax / municipal".
   *  Optional: most senses are distinguishable by their gloss alone. */
  label?: string;
  /** Where this meaning is the one that applies — "on a municipal letter",
   *  "in cooking". Optional, and only worth setting when the context is what
   *  separates this sense from its siblings rather than the gloss itself. */
  context?: string;
  /** Where this meaning came from. Shown to the learner whenever it isn't
   *  the hand-written dictionary, because provenance is the honest answer to
   *  "why does this entry look thinner than the others" — an online gloss
   *  with no article and no example currently just looks damaged, when in
   *  fact it's simply from somewhere else (see docs/recommendations.md,
   *  item 1, "Also worth one line of copy").
   *
   *    "curated"    hand-written in data/curated.ts
   *    "authored"   hand-written extra sense in data/senses.ts
   *    "imported"   from the FreeDict word list — no article, no example
   *    "derived"    split mechanically out of a packed gloss
   *    "online"     fetched live from Wiktionary
   *    "generated"  proposed by a model and accepted by a reviewer
   *                 (see scripts/complete-entries.mjs) */
  source?: "curated" | "authored" | "imported" | "derived" | "online" | "generated";
  /** True when this sense was derived mechanically rather than authored:
   *  split out of a single gloss that packed several meanings into one
   *  string ("to park; to put away"). It's a real meaning, but nobody has
   *  reviewed it and it has no example sentence of its own yet, so the UI
   *  shows it as a secondary meaning rather than as an equal choice, and the
   *  validator counts it separately. Promoted by giving it an example in
   *  data/senses.ts. */
  provisional?: boolean;
}

/**
 * The AUTHORED shape of a dictionary word, as written in data/curated.ts.
 *
 * Deliberately not the same type as DictionaryEntry: what an author writes is
 * one word with one gloss, one article and one example, and `senses` is
 * DERIVED from that at decode time (see data/dictionary.ts, which splits a
 * gloss like "to park; to put away" into two). Making authors hand-write a
 * senses array would be asking them to maintain the derivation by hand, and
 * making DictionaryEntry.senses optional would put the old bug back — an
 * entry with no meanings at all would typecheck.
 */
export interface CuratedEntry {
  dutch: string;
  english: string;
  gender: Gender;
  example: string;
  exampleEn: string;
}

/** A bundled dictionary word (offline, authored).
 *
 *  `senses` is the source of truth and is never empty. The top-level
 *  english/gender/example/exampleEn mirror `senses[0]` exactly — they're
 *  kept so that every reader that only wants the primary meaning (deck rows,
 *  flashcards, the mastery bar) stays a plain field access, and so this
 *  change didn't have to rewrite every screen at once. Write through
 *  `senses`; read either. */
export interface DictionaryEntry {
  id: string;
  dutch: string;
  english: string;
  gender: Gender;
  example: string;
  exampleEn: string;
  /** Every known meaning, most common first. Never empty. */
  senses: WordSense[];
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

/** A word the user has added to their flashcard deck: dictionary entry id +
 *  its spaced-repetition state (see lib/learningEngine).
 *
 *  The id is a SENSE key, not a word (see lib/wordSources): "aanslag" is the
 *  primary meaning and "aanslag#1" the second, so the same Dutch word can sit
 *  in the deck twice under two meanings with independent progress. Keys for
 *  the primary sense are the bare word, which is exactly what every deck
 *  saved before this change already contains — so nothing needed migrating. */
export interface DeckItem extends Word {
  dateAdded: number;
}

/** One flashcard answer during a practice session. */
export interface PracticeResult {
  entryId: string;
  grade: Grade;
  timestamp: number;
}

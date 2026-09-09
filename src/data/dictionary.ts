/**
 * Woordkast bundled dictionary — Dutch → English, fully offline.
 *
 * Generated from data/curated.ts by `npm run dictionary`, which is also where
 * the encoding is explained. Entries are decoded once here, at module load.
 *
 * Example sentences are deliberately NOT in this module: they are two thirds
 * of the data but are only ever shown a word at a time, so they load
 * separately (see ./examples). Entries therefore start with empty
 * `example`/`exampleEn`, and lib/wordSources fills them in once available.
 *
 * ── Senses ────────────────────────────────────────────────────────────────
 * A gloss that packs several meanings into one string — "stallen = to park;
 * to put away" — is split here into separate senses, because a word with two
 * meanings and one slot to hold them is the reason a learner could meet
 * "aanslag" as a tax bill and be shown an assassination.
 *
 * The split is on ";" only. A "/" separates near-synonyms that are one
 * meaning worded two ways ("please / here you go"), and splitting those would
 * manufacture choices where there is no choice to make; a ";" is what the
 * authoring convention uses for genuinely different meanings. That's 1,823
 * words that gain a second meaning for free, with no new bytes shipped: the
 * text was always there, it just wasn't structured.
 *
 * Senses derived this way are marked `provisional` — real meanings, but
 * mechanically separated and carrying no example sentence of their own, so
 * the UI presents them as secondary rather than as equal choices. Giving one
 * an example in data/senses.ts is what promotes it.
 */
import type { DictionaryEntry, Gender, WordSense } from "../lib/types";
import { CORE, RICH_COUNT } from "./core.generated";

const GENDER: Record<string, Gender> = { d: "de", h: "het", n: "none", u: "unknown" };

/** Splits a packed gloss into one gloss per meaning. Returns at least one. */
function splitGloss(english: string): string[] {
  const parts = english
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [english];
}

/** The full bundled dictionary — curated (rich) words first, then the rest. */
export const DICTIONARY: DictionaryEntry[] = CORE.split("\n").map((line, index) => {
  const [dutch, english, genderCode] = line.split("\t");
  // Curated words come first and carry an example; everything after
  // RICH_COUNT came from the FreeDict import and carries neither an example
  // nor an article. That difference is now stated rather than left to look
  // like damage.
  const source = index < RICH_COUNT ? "curated" : "imported";
  const gender = GENDER[genderCode] ?? "unknown";
  const glosses = splitGloss(english);

  // The primary sense. Its example fields stay empty here and are filled by
  // wordSources once the lazily-loaded example chunk has arrived.
  const senses: WordSense[] = [
    { english: glosses[0], example: "", exampleEn: "", gender, source },
  ];
  for (const gloss of glosses.slice(1)) {
    // Same word, same part of speech, so the article carries over; what these
    // lack is an example of their own, which is what `provisional` records.
    senses.push({
      english: gloss,
      example: "",
      exampleEn: "",
      gender,
      source: "derived",
      provisional: true,
    });
  }

  return {
    id: dutch.toLowerCase(),
    dutch,
    english: senses[0].english,
    gender,
    example: "",
    exampleEn: "",
    senses,
  };
});

/** Count of words that carry an example sentence (the curated core, first). */
export { RICH_COUNT };

const BY_ID = new Map(DICTIONARY.map((e) => [e.id, e]));

export function findEntry(id: string): DictionaryEntry | undefined {
  return BY_ID.get(id);
}

/** Position in DICTIONARY — how example sentences are keyed, since they are
 *  index-aligned with the first RICH_COUNT entries. */
const INDEX_BY_ID = new Map(DICTIONARY.map((e, i) => [e.id, i]));

export function indexOfEntry(id: string): number | undefined {
  return INDEX_BY_ID.get(id);
}

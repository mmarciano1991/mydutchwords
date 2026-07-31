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
 */
import type { DictionaryEntry, Gender } from "../lib/types";
import { CORE, RICH_COUNT } from "./core.generated";

const GENDER: Record<string, Gender> = { d: "de", h: "het" };

/** The full bundled dictionary — curated (rich) words first, then the rest. */
export const DICTIONARY: DictionaryEntry[] = CORE.split("\n").map((line) => {
  const [dutch, english, gender] = line.split("\t");
  return {
    id: dutch.toLowerCase(),
    dutch,
    english,
    gender: GENDER[gender] ?? null,
    example: "",
    exampleEn: "",
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

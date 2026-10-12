/* The pre-server dictionary, frozen — kept ONLY so deck items saved before
   the server dictionary existed ("aanslag", "aanslag#1") still open. It is
   not a source of new data: nothing can be searched or added from it.

   Loaded lazily (a separate chunk) and only when a deck holds such an id;
   lib/wordSources then pins each one's content locally, after which this
   chunk is never needed again for that learner. */
import type { DictionaryEntry, WordSense } from "../../lib/types";
import { findEntry, indexOfEntry } from "./dictionary";
import { exampleAt, loadExamples } from "./examples";
import { extraSensesFor } from "./senses";

const SENSE_SEPARATOR = "#";

/** "aanslag#1" → { baseId: "aanslag", index: 1 }; anything else is index 0. */
export function parseLegacyKey(id: string): { baseId: string; index: number } {
  const at = id.lastIndexOf(SENSE_SEPARATOR);
  if (at === -1) return { baseId: id, index: 0 };
  const suffix = id.slice(at + 1);
  if (!/^\d+$/.test(suffix)) return { baseId: id, index: 0 };
  return { baseId: id.slice(0, at), index: Number(suffix) };
}

function word(baseId: string): DictionaryEntry | undefined {
  const bundled = findEntry(baseId);
  if (!bundled) return undefined;
  const example = exampleAt(indexOfEntry(baseId));
  const primary: WordSense = { ...bundled.senses[0], ...(example ?? {}) };
  const senses = [primary, ...extraSensesFor(baseId), ...bundled.senses.slice(1)];
  return { ...bundled, english: primary.english, gender: primary.gender, example: primary.example, exampleEn: primary.exampleEn, senses };
}

/** The stored content a legacy deck id had, or undefined. */
export function legacyEntry(id: string): DictionaryEntry | undefined {
  const { baseId, index } = parseLegacyKey(id);
  const base = word(baseId);
  const sense = base?.senses[index];
  if (!base || !sense) return undefined;
  return { ...base, id, english: sense.english, gender: sense.gender, example: sense.example, exampleEn: sense.exampleEn };
}

/** Resolves once the legacy examples have loaded too. */
export function ready(): Promise<void> {
  return loadExamples();
}

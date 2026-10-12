/* The dictionary for tests: the fixture the pipeline extracted from a real
   build (scripts/dictionary/fixture.mjs), served from memory. */
import fixture from "./fixture.json";
import type { KeyRow, WordEntry } from "./model";
import { memorySource } from "./memorySource";
import { setDictionarySource } from "./service";
import type { DictionarySource } from "./source";

export const FIXTURE_WORDS = fixture.words as unknown as WordEntry[];
export const FIXTURE_KEYS = fixture.keys as unknown as KeyRow[];

export function fixtureSource(): DictionarySource {
  return memorySource(FIXTURE_WORDS, FIXTURE_KEYS);
}

/** Points the app's dictionary at the fixture (and clears its caches). */
export function useFixtureDictionary(): DictionarySource {
  const source = fixtureSource();
  setDictionarySource(source);
  return source;
}

export function fixtureWord(form: string): WordEntry {
  const w = FIXTURE_WORDS.find((x) => x.form === form);
  if (!w) throw new Error(`"${form}" is not in the fixture — add it to scripts/dictionary/fixture.mjs`);
  return w;
}

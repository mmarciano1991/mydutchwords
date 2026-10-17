/* The pre-server dictionary, frozen — kept ONLY so deck items saved before
   the server dictionary existed ("aanslag", "aanslag#1") still open. It is
   not a source of new data: nothing can be searched or added from it.

   It used to ship as 1.3 MB of JavaScript; it is now static JSON in
   public/legacy, one shard per first letter, fetched only for a deck that
   holds such an id. lib/wordSources then pins each entry's content locally
   (and sync stores it with the account), after which the shard is never
   needed again for that learner.

   A native shell can leave public/legacy out of its bundle: a learner with
   legacy cards gets them from the account's synced copy, and the fetch
   failing just leaves those cards waiting, as offline does today. */
import type { DictionaryEntry, WordSense } from "./types";

const SENSE_SEPARATOR = "#";

/** "aanslag#1" → { baseId: "aanslag", index: 1 }; anything else is index 0. */
export function parseLegacyKey(id: string): { baseId: string; index: number } {
  const at = id.lastIndexOf(SENSE_SEPARATOR);
  if (at === -1) return { baseId: id, index: 0 };
  const suffix = id.slice(at + 1);
  if (!/^\d+$/.test(suffix)) return { baseId: id, index: 0 };
  return { baseId: id.slice(0, at), index: Number(suffix) };
}

/** The shard a base id lives in: its first letter, or "_" for anything that
 *  isn't a plain a–z letter. */
export function legacyShardOf(baseId: string): string {
  const first = baseId.normalize("NFD").charAt(0).toLowerCase();
  return /^[a-z]$/.test(first) ? first : "_";
}

/** A base word as stored: its form and its senses (empty example fields
 *  omitted). */
interface StoredWord {
  dutch: string;
  senses: (Omit<WordSense, "example" | "exampleEn"> & { example?: string; exampleEn?: string })[];
}

type Shard = Record<string, StoredWord>;

const shards = new Map<string, Promise<Shard>>();

function loadShard(name: string, fetcher: typeof fetch): Promise<Shard> {
  let p = shards.get(name);
  if (!p) {
    p = fetcher(`${import.meta.env.BASE_URL}legacy/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`legacy/${name}.json: HTTP ${r.status}`);
      return r.json() as Promise<Shard>;
    });
    // A failed fetch is retried next time, not remembered.
    p.catch(() => shards.delete(name));
    shards.set(name, p);
  }
  return p;
}

/** The entry a legacy deck id stood for, from its base word's senses. */
export function entryAt(word: StoredWord, id: string, index: number): DictionaryEntry | undefined {
  const senses: WordSense[] = word.senses.map((s) => ({ ...s, example: s.example ?? "", exampleEn: s.exampleEn ?? "" }));
  const sense = senses[index];
  if (!sense) return undefined;
  return { id, dutch: word.dutch, english: sense.english, gender: sense.gender, example: sense.example, exampleEn: sense.exampleEn, senses };
}

/** The stored content of each legacy id that the frozen dictionary has.
 *  Ids it doesn't have are left out; a shard that can't be fetched rejects. */
export async function legacyEntries(ids: string[], fetcher: typeof fetch = fetch): Promise<Map<string, DictionaryEntry>> {
  const found = new Map<string, DictionaryEntry>();
  const byShard = new Map<string, string[]>();
  for (const id of ids) {
    const shard = legacyShardOf(parseLegacyKey(id).baseId);
    byShard.set(shard, [...(byShard.get(shard) ?? []), id]);
  }
  await Promise.all(
    [...byShard].map(async ([name, list]) => {
      const shard = await loadShard(name, fetcher);
      for (const id of list) {
        const { baseId, index } = parseLegacyKey(id);
        const base = Object.prototype.hasOwnProperty.call(shard, baseId) ? shard[baseId] : undefined;
        const entry = base && entryAt(base, id, index);
        if (entry) found.set(id, entry);
      }
    })
  );
  return found;
}

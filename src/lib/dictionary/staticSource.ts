/* The dictionary as static JSON shards — for a build with no Supabase
   project, so the app still works fully without an account (written by
   scripts/dictionary/static.mjs to public/dictionary).

     k/<2 letters>.json   keys starting with those letters, with each
                          word's form, frequency and preview
     w/<3 letters>.json   full entries, by the first letters of their key
     canon/<letter>.json  confusion keys, for "Did you mean…?"

   Mid-word matches only search the key shard already loaded — a known
   limit of the offline fallback, not of the server. */
import type { KeyRow, WordEntry, WordKind, WordPreview } from "./model";
import { searchKey } from "./normalize";
import type { DictionarySource, FuzzyRow, LookupRow, PartRow, SuggestRow } from "./source";

interface Head {
  form: string;
  kind: WordKind;
  frequency: number;
  preview: WordPreview;
}

interface KeyShard {
  keys: KeyRow[];
  heads: Record<string, Head>;
}

interface CanonRow {
  canon: string;
  wordId: string;
  form: string;
  frequency: number;
  searchKey: string;
  preview: WordPreview;
}

const safe = (s: string) => s.replace(/[^a-z0-9]/g, "_");
/** Key shard: the first two characters of a search key. */
export const shardOf = (key: string) => safe(key.slice(0, 2).padEnd(2, "_"));
/** Word shard: the first three characters of the word's own key. */
export const wordShardOf = (key: string) => safe(key.slice(0, 3).padEnd(3, "_"));

const VIA_ORDER: Record<KeyRow["via"], number> = { lemma: 0, form: 1, variant: 2, expansion: 3 };

export function staticSource(baseUrl: string, fetcher: typeof fetch = fetch): DictionarySource {
  const cache = new Map<string, Promise<unknown>>();

  function getJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    let p = cache.get(path);
    if (!p) {
      p = fetcher(`${baseUrl}${path}`, { signal }).then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
        // A missing shard answered with the app's own HTML (a single-page
        // fallback, as Vite's dev server does) is a missing shard too.
        if (/text\/html/i.test(r.headers.get("content-type") ?? "")) return null;
        return r.json();
      });
      // A failed fetch is retried next time, not remembered.
      p.catch(() => cache.delete(path));
      cache.set(path, p);
    }
    return p as Promise<T | null>;
  }

  const keyShard = (key: string, signal?: AbortSignal) => getJson<KeyShard>(`k/${shardOf(key)}.json`, signal);

  async function words(ids: string[], signal?: AbortSignal): Promise<WordEntry[]> {
    const byShard = new Map<string, Set<string>>();
    for (const id of ids) {
      const name = wordShardOf(searchKey(id));
      if (!byShard.has(name)) byShard.set(name, new Set());
      byShard.get(name)!.add(id);
    }
    const lists = await Promise.all(
      [...byShard].map(async ([name, wanted]) => ((await getJson<WordEntry[]>(`w/${name}.json`, signal)) ?? []).filter((w) => wanted.has(w.id)))
    );
    return lists.flat();
  }

  return {
    async suggest(key, limit, signal) {
      const shard = await keyShard(key, signal);
      if (!shard) return [];
      const best = new Map<string, { row: KeyRow; exact: boolean; mid: boolean }>();
      for (const row of shard.keys) {
        if (!row.key.startsWith(key)) continue;
        const exact = row.key === key;
        const prev = best.get(row.wordId);
        if (!prev || Number(exact) > Number(prev.exact) || (exact === prev.exact && VIA_ORDER[row.via] < VIA_ORDER[prev.row.via])) {
          best.set(row.wordId, { row, exact, mid: false });
        }
      }
      return [...best.values()]
        .map((b) => ({ ...b, head: shard.heads[b.row.wordId] }))
        .filter((b) => b.head)
        .sort(
          (a, b) =>
            Number(b.exact) - Number(a.exact) ||
            Number(a.exact && a.row.via !== "lemma") - Number(b.exact && b.row.via !== "lemma") ||
            Number(a.row.via === "variant") - Number(b.row.via === "variant") ||
            Number(a.row.via === "expansion") - Number(b.row.via === "expansion") ||
            a.head.frequency - b.head.frequency ||
            Number(a.head.kind === "properNoun") - Number(b.head.kind === "properNoun") ||
            a.head.form.localeCompare(b.head.form)
        )
        .slice(0, limit)
        .map(
          ({ row, exact, mid, head }): SuggestRow => ({
            wordId: row.wordId,
            form: head.form,
            kind: head.kind,
            via: row.via,
            matched: row.form,
            useId: row.useId,
            frequency: head.frequency,
            exact,
            mid,
            preview: head.preview,
          })
        );
    },
    async lookup(key, signal) {
      const shard = await keyShard(key, signal);
      const rows = (shard?.keys ?? []).filter((r) => r.key === key);
      const found = new Map((await words([...new Set(rows.map((r) => r.wordId))], signal)).map((w) => [w.id, w]));
      return rows
        .filter((r) => found.has(r.wordId))
        .map((r): LookupRow => ({ word: found.get(r.wordId)!, via: r.via, useId: r.useId, matched: r.form }))
        .sort((a, b) => Number(b.via === "lemma") - Number(a.via === "lemma") || a.word.frequency - b.word.frequency);
    },
    async fuzzy(key, canon, signal) {
      const first = await getJson<CanonRow[]>(`canon/${shardOf(canon).slice(0, 1)}.json`, signal);
      const second = shardOf(key)[0] === shardOf(canon)[0] ? [] : await getJson<CanonRow[]>(`canon/${shardOf(key).slice(0, 1)}.json`, signal);
      const all = [...(first ?? []), ...(second ?? [])];
      const exact = all.filter((r) => r.canon === canon);
      const close = all.filter((r) => r.canon !== canon && Math.abs(r.searchKey.length - key.length) <= 2);
      return [...exact, ...close].slice(0, 400).map((r): FuzzyRow => ({ wordId: r.wordId, form: r.form, frequency: r.frequency, preview: r.preview }));
    },
    async parts(keys, signal) {
      const out: PartRow[] = [];
      const shards = new Map<string, KeyShard | null>();
      for (const k of new Set(keys)) {
        const name = shardOf(k);
        if (!shards.has(name)) shards.set(name, await keyShard(k, signal));
        const shard = shards.get(name);
        if (!shard) continue;
        let best: { row: KeyRow; lemma: boolean } | null = null;
        for (const row of shard.keys) {
          if (row.key !== k || row.via === "expansion") continue;
          const lemma = row.via === "lemma" || row.via === "variant";
          if (!best || (lemma && !best.lemma) || (lemma === best.lemma && shard.heads[row.wordId].frequency < shard.heads[best.row.wordId].frequency)) best = { row, lemma };
        }
        if (best) {
          const head = shard.heads[best.row.wordId];
          out.push({ key: k, wordId: best.row.wordId, form: head.form, kind: head.kind, frequency: head.frequency, isLemma: best.lemma });
        }
      }
      return out;
    },
    words,
    async wordsForSenses(senseIds, signal) {
      const index = (await getJson<Record<string, string>>("senses.json", signal)) ?? {};
      return words([...new Set(senseIds.map((s) => index[s]).filter(Boolean))], signal);
    },
    async common(limit, signal) {
      return ((await getJson<FuzzyRow[]>("common.json", signal)) ?? []).slice(0, limit);
    },
  };
}

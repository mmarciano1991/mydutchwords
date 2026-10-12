/* The dictionary in memory — the same answers as the server's RPCs, from
   arrays of words and keys. Used by the tests (with the fixture the
   pipeline extracts) and, shard by shard, by the static source. The
   ordering rules mirror supabase/migrations/20261011120000_dictionary.sql;
   a change to one is a change to both. */
import { previewOf, type KeyRow, type WordEntry } from "./model.ts";
import { confusionKey } from "./normalize.ts";
import type { DictionarySource, FuzzyRow, LookupRow, PartRow, SuggestRow } from "./source";

/** Trigram similarity, as pg_trgm computes it (close enough to rank). */
function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

export function similarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

const VIA_ORDER: Record<KeyRow["via"], number> = { lemma: 0, form: 1, variant: 2, expansion: 3 };

export function memorySource(words: WordEntry[], keys: KeyRow[]): DictionarySource {
  const byId = new Map(words.map((w) => [w.id, w]));
  const sortedKeys = [...keys].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const canon = new Map<string, WordEntry[]>();
  for (const w of words) {
    const c = confusionKey(w.form);
    const list = canon.get(c);
    if (list) list.push(w);
    else canon.set(c, [w]);
  }
  const senseToWord = new Map<string, string>();
  for (const w of words) for (const u of w.uses) for (const s of u.senses) senseToWord.set(s.id, w.id);

  /** Binary search for the first key ≥ prefix. */
  function firstAtLeast(prefix: string): number {
    let lo = 0;
    let hi = sortedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedKeys[mid].key < prefix) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  const fuzzyRow = (w: WordEntry): FuzzyRow => ({ wordId: w.id, form: w.form, frequency: w.frequency, preview: previewOf(w) });

  return {
    async suggest(key, limit) {
      const best = new Map<string, { row: KeyRow; exact: boolean; mid: boolean }>();
      for (let i = firstAtLeast(key); i < sortedKeys.length && sortedKeys[i].key.startsWith(key); i++) {
        const row = sortedKeys[i];
        const exact = row.key === key;
        const prev = best.get(row.wordId);
        const better =
          !prev ||
          Number(exact) > Number(prev.exact) ||
          (exact === prev.exact && VIA_ORDER[row.via] < VIA_ORDER[prev.row.via]);
        if (better) best.set(row.wordId, { row, exact, mid: false });
      }
      if (key.length >= 3) {
        for (const row of sortedKeys) {
          if (row.via !== "lemma" || best.has(row.wordId)) continue;
          if (row.key.includes(key)) best.set(row.wordId, { row, exact: false, mid: true });
        }
      }
      const rows = [...best.values()]
        .map(({ row, exact, mid }) => ({ w: byId.get(row.wordId)!, row, exact, mid }))
        .filter((x) => x.w)
        .sort(
          (a, b) =>
            Number(b.exact) - Number(a.exact) ||
            Number(a.exact && a.row.via !== "lemma") - Number(b.exact && b.row.via !== "lemma") ||
            Number(a.mid) - Number(b.mid) ||
            Number(a.row.via === "variant") - Number(b.row.via === "variant") ||
            Number(a.row.via === "expansion") - Number(b.row.via === "expansion") ||
            a.w.frequency - b.w.frequency ||
            Number(a.w.kind === "properNoun") - Number(b.w.kind === "properNoun") ||
            a.w.form.localeCompare(b.w.form)
        )
        .slice(0, limit);
      return rows.map(
        ({ w, row, exact, mid }): SuggestRow => ({
          wordId: w.id,
          form: w.form,
          kind: w.kind,
          via: row.via,
          matched: row.form,
          useId: row.useId,
          frequency: w.frequency,
          exact,
          mid,
          preview: previewOf(w),
        })
      );
    },
    async lookup(key) {
      const out: LookupRow[] = [];
      for (let i = firstAtLeast(key); i < sortedKeys.length && sortedKeys[i].key === key; i++) {
        const row = sortedKeys[i];
        const word = byId.get(row.wordId);
        if (word) out.push({ word, via: row.via, useId: row.useId, matched: row.form });
      }
      return out.sort((a, b) => Number(b.via === "lemma") - Number(a.via === "lemma") || a.word.frequency - b.word.frequency);
    },
    async fuzzy(key, canonKey) {
      const exact = canon.get(canonKey) ?? [];
      const close = words
        .filter((w) => !exact.includes(w) && (w.searchKey[0] === key[0] || confusionKey(w.form)[0] === canonKey[0]))
        .map((w) => ({ w, s: similarity(w.searchKey, key) }))
        .filter((x) => x.s >= 0.3)
        .sort((a, b) => b.s - a.s || a.w.frequency - b.w.frequency)
        .slice(0, 30)
        .map((x) => x.w);
      return [...exact, ...close].slice(0, 30).map(fuzzyRow);
    },
    async parts(partKeys) {
      const out: PartRow[] = [];
      for (const key of new Set(partKeys)) {
        let best: { row: KeyRow; lemma: boolean } | null = null;
        for (let i = firstAtLeast(key); i < sortedKeys.length && sortedKeys[i].key === key; i++) {
          const row = sortedKeys[i];
          if (row.via === "expansion") continue;
          const lemma = row.via === "lemma" || row.via === "variant";
          const w = byId.get(row.wordId);
          if (!w) continue;
          if (!best || (lemma && !best.lemma) || (lemma === best.lemma && w.frequency < byId.get(best.row.wordId)!.frequency)) best = { row, lemma };
        }
        if (best) {
          const w = byId.get(best.row.wordId)!;
          out.push({ key, wordId: w.id, form: w.form, kind: w.kind, frequency: w.frequency, isLemma: best.lemma });
        }
      }
      return out;
    },
    async words(ids) {
      return ids.map((id) => byId.get(id)).filter((w): w is WordEntry => Boolean(w));
    },
    async wordsForSenses(senseIds) {
      const ids = new Set(senseIds.map((s) => senseToWord.get(s)).filter((x): x is string => Boolean(x)));
      return [...ids].map((id) => byId.get(id)!).filter(Boolean);
    },
    async common(limit) {
      return [...words]
        .filter((w) => w.kind === "word" || w.kind === "compound")
        .sort((a, b) => a.frequency - b.frequency)
        .slice(0, limit)
        .map(fuzzyRow);
    },
  };
}

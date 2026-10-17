/* The dictionary on the server — Supabase RPCs (see
   supabase/migrations/20261011120000_dictionary.sql). Read-only, works
   signed out (the tables are public to read). */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WordEntry } from "./model";
import type { DictionarySource, FuzzyRow, LookupRow, PartRow, SuggestRow } from "./source";

type Row = Record<string, unknown>;

async function rpc<T>(db: SupabaseClient, fn: string, args: Row, signal?: AbortSignal): Promise<T[]> {
  let call = db.rpc(fn, args);
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) throw new Error(`${fn}: ${error.message}`);
  return (data ?? []) as T[];
}

/** Ids per call. The id-list RPCs refuse more than 500
 *  (20261017120000_dictionary_rpc_limits.sql); a deck can hold more. */
export const ID_BATCH = 200;

/** An id-list RPC over any number of ids, in batches. */
async function rpcBatched<T>(db: SupabaseClient, fn: string, arg: string, ids: string[], signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    rows.push(...(await rpc<T>(db, fn, { [arg]: ids.slice(i, i + ID_BATCH) }, signal)));
  }
  return rows;
}

export function supabaseSource(db: SupabaseClient): DictionarySource {
  return {
    async suggest(key, limit, signal) {
      const rows = await rpc<Row>(db, "dict_suggest", { q: key, lim: limit }, signal);
      return rows.map(
        (r): SuggestRow => ({
          wordId: r.word_id as string,
          form: r.form as string,
          kind: r.kind as SuggestRow["kind"],
          via: r.via as SuggestRow["via"],
          matched: r.matched as string,
          useId: (r.use_id as string) || undefined,
          frequency: r.frequency as number,
          exact: Boolean(r.exact),
          mid: Boolean(r.mid),
          preview: r.preview as SuggestRow["preview"],
        })
      );
    },
    async lookup(key, signal) {
      const rows = await rpc<Row>(db, "dict_lookup", { q: key }, signal);
      return rows.map(
        (r): LookupRow => ({
          word: r.data as WordEntry,
          via: r.via as LookupRow["via"],
          useId: (r.use_id as string) || undefined,
          matched: r.matched as string,
        })
      );
    },
    async fuzzy(key, canon, signal) {
      const rows = await rpc<Row>(db, "dict_fuzzy", { q: key, canon, lim: 30 }, signal);
      return rows.map((r): FuzzyRow => ({ wordId: r.word_id as string, form: r.form as string, frequency: r.frequency as number, preview: r.preview as FuzzyRow["preview"] }));
    },
    async parts(keys, signal) {
      if (!keys.length) return [];
      const rows = await rpcBatched<Row>(db, "dict_parts", "keys", keys, signal);
      return rows.map(
        (r): PartRow => ({
          key: r.key as string,
          wordId: r.word_id as string,
          form: r.form as string,
          kind: r.kind as PartRow["kind"],
          frequency: r.frequency as number,
          isLemma: Boolean(r.is_lemma),
        })
      );
    },
    async words(ids, signal) {
      if (!ids.length) return [];
      const rows = await rpcBatched<Row>(db, "dict_words_get", "ids", ids, signal);
      return rows.map((r) => r.data as WordEntry);
    },
    async wordsForSenses(senseIds, signal) {
      if (!senseIds.length) return [];
      const rows = await rpcBatched<Row>(db, "dict_senses_get", "ids", senseIds, signal);
      const byId = new Map(rows.map((r) => [r.word_id as string, r.data as WordEntry]));
      return [...byId.values()];
    },
    async common(limit, signal) {
      const rows = await rpc<Row>(db, "dict_common", { lim: limit }, signal);
      return rows.map((r): FuzzyRow => ({ wordId: r.word_id as string, form: r.form as string, frequency: r.frequency as number, preview: r.preview as FuzzyRow["preview"] }));
    },
  };
}

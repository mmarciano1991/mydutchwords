/* Where the dictionary is read from. The app talks to one interface; three
   implementations sit behind it:

     supabaseSource  the server (production) — RPCs from
                     supabase/migrations/20261011120000_dictionary.sql
     staticSource    the same build as JSON shards under /dictionary/, for a
                     build with no Supabase project (see scripts/dictionary/
                     static.mjs)
     memorySource    in-memory, from arrays — tests and the fixture

   Every method answers with plain data; caching, offline behaviour and
   ranking live one level up, in ./service. */
import type { KeyRow, WordEntry, WordPreview, WordKind } from "./model";

export interface SuggestRow {
  wordId: string;
  form: string;
  kind: WordKind;
  via: KeyRow["via"];
  matched: string;
  useId?: string;
  frequency: number;
  exact: boolean;
  mid: boolean;
  preview: WordPreview;
}

export interface LookupRow {
  word: WordEntry;
  via: KeyRow["via"];
  useId?: string;
  matched: string;
}

export interface FuzzyRow {
  wordId: string;
  form: string;
  frequency: number;
  preview: WordPreview;
}

export interface PartRow {
  key: string;
  wordId: string;
  form: string;
  kind: WordKind;
  frequency: number;
  isLemma: boolean;
}

export interface DictionarySource {
  /** Suggestions for a search key (≥ 2 letters): prefix matches first. */
  suggest(key: string, limit: number, signal?: AbortSignal): Promise<SuggestRow[]>;
  /** Every word an exact key leads to — its own form, an inflected form, a
   *  variant. */
  lookup(key: string, signal?: AbortSignal): Promise<LookupRow[]>;
  /** Candidates for "Did you mean…?". */
  fuzzy(key: string, canon: string, signal?: AbortSignal): Promise<FuzzyRow[]>;
  /** What the dictionary knows about each compound segment. */
  parts(keys: string[], signal?: AbortSignal): Promise<PartRow[]>;
  /** Full entries by word id. */
  words(ids: string[], signal?: AbortSignal): Promise<WordEntry[]>;
  /** The words holding these sense ids — for refreshing deck copies. */
  wordsForSenses(senseIds: string[], signal?: AbortSignal): Promise<WordEntry[]>;
  /** Common words, for exercise distractors. */
  common(limit: number, signal?: AbortSignal): Promise<FuzzyRow[]>;
}

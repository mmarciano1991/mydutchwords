/* ──────────────────────────────────────────────────────────────────────────
   The dictionary service — what screens call. Sits on a DictionarySource
   (server, static shards or memory) and adds:

     search()      autocomplete for Add a word: exact match (an inflected
                   form counts: "liep" → lopen), then words starting with
                   the query by frequency, then spelling variants, then
                   "Did you mean…?", then a compound split — results cached
                   per key
     lookup()      every word a typed or tapped form can be, with the uses
                   it reaches ("was" → zijn, wassen, de was); with a
                   sentence, the likely one first
     compound      a compound the dictionary doesn't hold, split into
                   verified parts, article and plural from the head, its
                   meaning labelled "Reconstructed meaning"

   The whole word always beats a split; a split always beats a typo guess,
   and a typo guess is never offered next to a real match.
   ────────────────────────────────────────────────────────────────────────── */
import { isSupabaseConfigured, supabase } from "../supabase";
import { candidateSegments, decomposeCompound, headOf, type PartInfo } from "./compound";
import { rankTypos } from "./fuzzy";
import type { CompoundNode, Sense, Use, WordEntry, WordPreview } from "./model";
import { confusionKey, searchKey, stripEdgePunctuation } from "./normalize";
import type { DictionarySource, FuzzyRow, SuggestRow } from "./source";
import { staticSource } from "./staticSource";
import { supabaseSource } from "./supabaseSource";
import { tokenize } from "./checks";

let source: DictionarySource | null = null;

/** The configured source: the server when a Supabase project is set up,
 *  otherwise the static shards shipped next to the app. */
export function dictionarySource(): DictionarySource {
  if (!source) {
    source = isSupabaseConfigured && supabase ? supabaseSource(supabase) : staticSource(`${import.meta.env.BASE_URL}dictionary/`);
  }
  return source;
}

/** Swaps the source (tests). Clears every cache. */
export function setDictionarySource(next: DictionarySource | null): void {
  source = next;
  searchCache.clear();
  lookupCache.clear();
}

// ── Search ──

export const MIN_QUERY = 2;

/** The frequency rank of a word not in the frequency list (see the
 *  pipeline's sources/frequency.mjs). */
export const UNRANKED = 100_000;

export interface CompoundMatch {
  form: string;
  node: CompoundNode;
  /** The head's word — gives article, plural and the meaning's last part. */
  head: WordEntry;
  /** Senses built from the parts, flagged `reconstructed`. */
  word: WordEntry;
}

export interface SearchResult {
  query: string;
  key: string;
  suggestions: SuggestRow[];
  /** More suggestions exist beyond the limit. */
  hasMore: boolean;
  /** Only when nothing matched by prefix. */
  didYouMean: FuzzyRow[];
  compound: CompoundMatch | null;
}

const searchCache = new Map<string, SearchResult>();
const lookupCache = new Map<string, LookupResult>();
const CACHE_MAX = 300;

function remember<V>(cache: Map<string, V>, key: string, value: V): V {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
  return value;
}

/** A search result already in the cache — answered instantly, and the one
 *  kept on screen when the network fails. */
export function cachedSearch(query: string, limit: number): SearchResult | undefined {
  return searchCache.get(`${searchKey(stripEdgePunctuation(query))}|${limit}`);
}

export async function search(query: string, { limit = 8, signal }: { limit?: number; signal?: AbortSignal } = {}): Promise<SearchResult> {
  const clean = stripEdgePunctuation(query);
  const key = searchKey(clean);
  const empty: SearchResult = { query, key, suggestions: [], hasMore: false, didYouMean: [], compound: null };
  if (key.length < MIN_QUERY) return empty;
  const cacheKey = `${key}|${limit}`;
  const hit = searchCache.get(cacheKey);
  if (hit) return { ...hit, query };

  const src = dictionarySource();
  const rows = await src.suggest(key, limit + 1, signal);
  const suggestions = rows.slice(0, limit);
  // A rare place name starting with the query ("klijn" → Klijndijk) is not
  // what a learner typed: it doesn't stop "Did you mean klein?".
  const prefixHit = rows.some((r) => !r.mid && !(r.kind === "properNoun" && r.frequency >= UNRANKED));
  let didYouMean: FuzzyRow[] = [];
  let compound: CompoundMatch | null = null;
  if (!prefixHit) {
    // Grammar before guesswork: a compound of real words is not a typo.
    compound = await findCompound(clean, signal);
    if (!compound) didYouMean = rankTypos(clean, await src.fuzzy(key, confusionKey(clean), signal), 3);
  }
  return remember(searchCache, cacheKey, { ...empty, suggestions, hasMore: rows.length > limit, didYouMean, compound });
}

// ── Lookup ──

export interface WordMatch {
  word: WordEntry;
  /** The uses this form reaches; null = every use (the word itself). */
  useIds: string[] | null;
  /** How the form reached the word. */
  via: "lemma" | "form" | "variant" | "expansion";
  /** The form as matched ("liep"). */
  matched: string;
}

export interface LookupResult {
  query: string;
  matches: WordMatch[];
  compound: CompoundMatch | null;
  didYouMean: FuzzyRow[];
}

export async function lookup(
  form: string,
  { sentence, signal }: { sentence?: { text: string; start: number; end: number }; signal?: AbortSignal } = {}
): Promise<LookupResult> {
  const clean = stripEdgePunctuation(form);
  const key = searchKey(clean);
  if (!key) return { query: form, matches: [], compound: null, didYouMean: [] };
  let result = lookupCache.get(key);
  if (!result) {
    const src = dictionarySource();
    const rows = await src.lookup(key, signal);
    const byWord = new Map<string, WordMatch>();
    for (const r of rows) {
      const prev = byWord.get(r.word.id);
      if (r.via === "lemma" || r.via === "variant" || r.via === "expansion") {
        byWord.set(r.word.id, { word: r.word, useIds: null, via: r.via, matched: r.matched });
      } else if (!prev) {
        byWord.set(r.word.id, { word: r.word, useIds: r.useId ? [r.useId] : null, via: "form", matched: r.matched });
      } else if (prev.useIds && r.useId && !prev.useIds.includes(r.useId)) {
        prev.useIds.push(r.useId);
      }
    }
    const matches = [...byWord.values()].sort((a, b) => a.word.frequency - b.word.frequency);
    let compound: CompoundMatch | null = null;
    let didYouMean: FuzzyRow[] = [];
    if (!matches.length) {
      compound = await findCompound(clean, signal);
      if (!compound) didYouMean = rankTypos(clean, await src.fuzzy(key, confusionKey(clean), signal), 3);
    }
    result = remember(lookupCache, key, { query: form, matches, compound, didYouMean });
  }
  if (sentence) return { ...result, query: form, matches: rankByContext(result.matches, sentence) };
  return { ...result, query: form };
}

// ── Context ──

const DETERMINERS = new Set(["de", "het", "een", "'t", "'n", "mijn", "jouw", "je", "zijn", "haar", "ons", "onze", "jullie", "hun", "uw", "deze", "dit", "die", "dat", "geen", "elke", "ieder", "iedere", "welke", "veel", "weinig"]);
const SUBJECTS = new Set(["ik", "jij", "je", "hij", "zij", "ze", "wij", "we", "jullie", "u", "het", "er", "dat", "dit", "men", "iemand", "niemand"]);
const MODALS = new Set(["kan", "kun", "kunt", "kunnen", "wil", "wilt", "willen", "moet", "moeten", "mag", "mogen", "zal", "zul", "zult", "zullen", "ga", "gaat", "gaan", "te"]);

/** Reorders matches by the words around the tapped one: after a
 *  determiner, nouns first; after a subject or a modal, verbs first. A
 *  nudge, never a filter: every match stays offered. */
export function rankByContext(matches: WordMatch[], sentence: { text: string; start: number; end: number }): WordMatch[] {
  const tokens = tokenize(sentence.text);
  const i = tokens.findIndex((t) => t.start === sentence.start);
  if (i < 0) return matches;
  const before = tokens[i - 1]?.lower;
  const wantPos = before && DETERMINERS.has(before) ? "noun" : before && (SUBJECTS.has(before) || MODALS.has(before)) ? "verb" : null;
  if (!wantPos) return matches;
  const score = (m: WordMatch) => {
    const uses = m.word.uses.filter((u) => !m.useIds || m.useIds.includes(u.id));
    return uses.some((u) => u.pos === wantPos) ? 0 : 1;
  };
  return [...matches].sort((a, b) => score(a) - score(b));
}

// ── Compounds ──

/** Splits a word the dictionary lacks into verified parts. Article and
 *  plural come from the head; the meaning is rebuilt from the parts'
 *  first meanings and labelled as such. */
export async function findCompound(form: string, signal?: AbortSignal): Promise<CompoundMatch | null> {
  const clean = stripEdgePunctuation(form);
  if (searchKey(clean).length < 6 && !clean.includes("-")) return null;
  const src = dictionarySource();
  const rows = await src.parts(candidateSegments(clean), signal);
  const byKey = new Map<string, PartInfo>(
    rows.map((r) => [r.key, { wordId: r.wordId, form: r.form, kind: r.kind, frequency: r.frequency, isLemma: r.isLemma }])
  );
  const node = decomposeCompound(clean, (k) => byKey.get(k));
  if (!node) return null;
  const leafIds = collectWordIds(node);
  const words = new Map((await src.words(leafIds, signal)).map((w) => [w.id, w]));
  const headNode = headOf(node);
  const head = headNode.wordId ? words.get(headNode.wordId) : undefined;
  if (!head) return null;
  const word = reconstruct(clean, node, head, words);
  return word ? { form: clean, node, head, word } : null;
}

function collectWordIds(node: CompoundNode): string[] {
  if (!node.left || !node.right) return node.wordId ? [node.wordId] : [];
  return [...collectWordIds(node.left), ...collectWordIds(node.right)];
}

/** The parts' first glosses, modifier before head ("housing benefit" +
 *  "application"). A name or acronym part is kept as written. */
function partGloss(node: CompoundNode, words: Map<string, WordEntry>): string | null {
  if (node.left && node.right) {
    const l = partGloss(node.left, words);
    const r = partGloss(node.right, words);
    return l && r ? `${l} ${r}` : null;
  }
  if (node.componentKind !== "lemma" && !node.wordId) return node.form;
  const w = node.wordId ? words.get(node.wordId) : undefined;
  const sense = w?.uses.find((u) => u.pos === "noun" || u.pos === "adjective" || u.pos === "verb")?.senses[0] ?? w?.uses[0]?.senses[0];
  if (!sense) return null;
  return sense.gloss.replace(/^to\s+/, "").replace(/\s*\([^)]*\)/g, "");
}

function reconstruct(form: string, node: CompoundNode, head: WordEntry, words: Map<string, WordEntry>): WordEntry | null {
  const headUse = head.uses.find((u) => u.pos === "noun") ?? head.uses[0];
  if (!headUse) return null;
  const gloss = partGloss(node, words);
  if (!gloss) return null;
  const headForm = headOf(node).form;
  const modifier = form.slice(0, form.length - headForm.length);
  // The plural is the head's, with the modifier in front.
  const plural = headUse.plural ? modifier + headUse.plural : undefined;
  const use: Use = {
    id: headUse.pos,
    pos: headUse.pos,
    subtype: headUse.subtype,
    forms: plural ? [{ form: plural, tags: ["plural"] }] : [],
    article: headUse.article,
    plural,
    fieldMeta: { article: headUse.fieldMeta.article ?? { sources: [], confidence: "checked" } },
    senses: [],
  };
  const sense: Sense = {
    id: `c_${searchKey(form)}`,
    gloss,
    variety: "NL",
    rank: 0,
    synonyms: [],
    antonyms: [],
    examples: [],
    reconstructed: true,
    meta: { sources: ["pipeline"], confidence: "checked" },
  };
  use.senses.push(sense);
  return {
    id: form,
    form,
    kind: "compound",
    variants: [],
    compound: node,
    frequency: 100_000,
    searchKey: searchKey(form),
    meta: { sources: ["pipeline"], confidence: "checked" },
    uses: [use],
  };
}

// ── Common words (exercise distractors) ──

let commonPromise: Promise<FuzzyRow[]> | null = null;

/** Frequent words with their preview — fetched once, then cached. */
export function commonWords(): Promise<FuzzyRow[]> {
  if (!commonPromise) {
    commonPromise = dictionarySource()
      .common(800)
      .catch((err) => {
        commonPromise = null;
        throw err;
      });
  }
  return commonPromise;
}

export type { WordPreview };

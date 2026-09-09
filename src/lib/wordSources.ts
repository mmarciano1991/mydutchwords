/* Word sources — resolves a deck word id to displayable content.
   Most deck words reference the bundled dictionary; words captured via the
   online lookup (Add a word) don't exist there, so they're stored as custom
   entries in localStorage and resolved from a module cache here. The same
   storage also holds an entry whose translation the user edited — an
   override, not a duplicate, since resolveEntry always prefers it.

   ── Sense keys ────────────────────────────────────────────────────────────
   A deck id is a SENSE, not a word. "aanslag" is the primary meaning and
   "aanslag#1" the second, so a learner who meets the word as a tax
   assessment and later as an attack ends up with two cards, each with its own
   progress — instead of the second meeting being answered with "you already
   have this word in your deck" and no way forward.

   The primary sense's key is the bare word, with no suffix. That is exactly
   what every deck saved before this change already contains, so nothing had
   to be migrated: old ids keep resolving to the primary meaning, which is
   what they always meant. */
import { DICTIONARY, findEntry, indexOfEntry } from "../data/dictionary";
import { exampleAt } from "../data/examples";
import { extraSensesFor } from "../data/senses";
import type { DictionaryEntry, WordSense } from "./types";

const CUSTOM_KEY = "woordkast.customWords";

/** Separates a word from its sense index in a deck id. Chosen because it
 *  can't occur in a Dutch headword, so an id is unambiguous. */
const SENSE_SEPARATOR = "#";

/** The deck id for one sense of a word. Sense 0 is the bare word — see the
 *  module header on why that matters. */
export function senseKey(entryId: string, index: number): string {
  return index === 0 ? entryId : `${entryId}${SENSE_SEPARATOR}${index}`;
}

/** Splits a deck id back into the word and which of its meanings. An id with
 *  no suffix, or a malformed one, is the primary sense. */
export function parseSenseKey(id: string): { baseId: string; index: number } {
  const at = id.lastIndexOf(SENSE_SEPARATOR);
  if (at === -1) return { baseId: id, index: 0 };
  const suffix = id.slice(at + 1);
  // Digits only. `Number("")` is 0, so an id merely ENDING in the separator
  // would otherwise parse as a valid primary key and quietly lose the "#"
  // from the word it belongs to.
  if (!/^\d+$/.test(suffix)) return { baseId: id, index: 0 };
  return { baseId: id.slice(0, at), index: Number(suffix) };
}

function loadCustom(): Map<string, DictionaryEntry> {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const list = raw ? (JSON.parse(raw) as DictionaryEntry[]) : [];
    // Guard the shape: a non-array here would throw on .map and take the
    // whole module down at import time, white-screening the app.
    if (!Array.isArray(list)) return new Map();
    return new Map(list.map((e) => [e.id, e]));
  } catch (err) {
    console.warn("[woordkast] could not read captured words — starting empty", err);
    return new Map();
  }
}

const custom = loadCustom();

/** The bundled dictionary's own answer for a WORD (never a sense key, never
 *  `custom`) — the entry with every sense it has, primary first.
 *
 *  Two things are layered on here that the decoded dictionary can't carry on
 *  its own: the example sentence, which loads separately (see data/examples),
 *  and the hand-reviewed extra senses in data/senses.ts, which are authored
 *  rather than derived and therefore rank above the provisional ones split
 *  out of a packed gloss. */
function resolveBundledWord(baseId: string): DictionaryEntry | undefined {
  const bundled = findEntry(baseId);
  if (!bundled) return undefined;

  // The example belongs to the primary sense: it was authored to demonstrate
  // that meaning, and attaching it to the others would be asserting it
  // demonstrates them too, which is the failure this whole change is about.
  const example = exampleAt(indexOfEntry(baseId));
  const primary: WordSense = { ...bundled.senses[0], ...(example ?? {}) };

  const authored = extraSensesFor(baseId);
  const provisional = bundled.senses.slice(1);
  const senses = [primary, ...authored, ...provisional];

  return {
    ...bundled,
    english: primary.english,
    gender: primary.gender,
    example: primary.example,
    exampleEn: primary.exampleEn,
    senses,
  };
}

/** Flattens one sense of an entry into an entry of its own, keyed by sense.
 *  `senses` is carried along so a screen showing this card can still offer
 *  the word's other meanings. */
function forSense(base: DictionaryEntry, index: number): DictionaryEntry | undefined {
  const sense = base.senses[index];
  if (!sense) return undefined;
  return {
    ...base,
    id: senseKey(base.id, index),
    english: sense.english,
    gender: sense.gender,
    example: sense.example,
    exampleEn: sense.exampleEn,
  };
}

/** What resolveEntry would return if this id had never been captured or
 *  edited — used to build the ordinary answer, and to tell whether a save is
 *  actually different from it (see addCustomEntry). */
function resolveWithoutCustom(id: string): DictionaryEntry | undefined {
  const { baseId, index } = parseSenseKey(id);
  const base = resolveBundledWord(baseId);
  if (!base) return undefined;
  return index === 0 ? base : forSense(base, index);
}

/** Bundled dictionary first, then user-captured custom words — except a
 *  custom entry wins outright when both exist: that's exactly the case where
 *  the user edited the translation for a word, and their choice should stick
 *  on every later screen, not just at the moment of capture. Custom (online,
 *  or overridden) words carry their own complete content and pass straight
 *  through — no merge needed. */
export function resolveEntry(id: string): DictionaryEntry | undefined {
  return custom.get(id) ?? resolveWithoutCustom(id);
}

function persistCustom(): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(Array.from(custom.values())));
  } catch (err) {
    console.warn("[woordkast] could not save captured words — kept for this session only", err);
  }
}

/** Turns an entry plus one of its senses into the entry that gets saved:
 *  keyed by that sense, carrying that sense's own content.
 *
 *  `senses` is kept rather than stripped — it's what lets a later screen say
 *  "this word has other meanings too" instead of presenting the chosen one as
 *  though it were the whole word. */
export function entryForSense(entry: DictionaryEntry, index: number): DictionaryEntry {
  const { baseId } = parseSenseKey(entry.id);
  const sense = entry.senses[index] ?? entry.senses[0];
  return {
    ...entry,
    id: senseKey(baseId, index),
    english: sense.english,
    gender: sense.gender,
    example: sense.example,
    exampleEn: sense.exampleEn,
  };
}

/** Corrects a word already resolved somewhere (bundled, custom, or a sense).
 *  Article/deadline glosses can be subtly wrong without ever being ambiguous
 *  enough to warrant a picker; this is the fallback for those. Same storage,
 *  same guard, same sync as addCustomEntry — a no-op if the edit matches the
 *  current content exactly. Gender is left as-is: this form only edits the
 *  translation and its example. */
export function editEntry(
  id: string,
  edit: { english: string; example: string; exampleEn: string }
): void {
  const current = resolveEntry(id);
  if (!current) return;
  addCustomEntry({ ...current, ...edit });
}

/** True when `entry`'s content is indistinguishable from what resolveEntry
 *  would already return without it — the case where storing it would be a
 *  redundant copy of the dictionary rather than an actual override.
 *
 *  Compares every field a save can change, not just the gloss: a save that
 *  only edits the example (translation left exactly as the default) is a real
 *  edit too, and comparing english alone would silently drop it. A bundled
 *  default never carries a metIn (see types.ts) — the dictionary doesn't know
 *  where a user met a word — so any entry with one set is never "just the
 *  default", even when the rest matches exactly. */
function matchesBundledDefault(entry: DictionaryEntry): boolean {
  const base = resolveWithoutCustom(entry.id);
  return (
    base !== undefined &&
    base.english === entry.english &&
    base.example === entry.example &&
    base.exampleEn === entry.exampleEn &&
    base.gender === entry.gender &&
    entry.metIn === undefined
  );
}

/** Persists a word captured from the online lookup, or one whose translation
 *  or example was edited directly — so resolveEntry keeps returning exactly
 *  what was chosen. A no-op when the content matches the bundled dictionary's
 *  own default — true for the vast majority of captures — which keeps custom
 *  storage limited to words that actually need an override instead of a
 *  redundant copy of the whole dictionary.
 *
 *  When it matches and an override already exists (an edit undone by typing
 *  the original back), that override is removed rather than left stale:
 *  otherwise it would keep pinning today's default even after a future
 *  dictionary update changed what that default is. */
export function addCustomEntry(entry: DictionaryEntry): void {
  if (matchesBundledDefault(entry)) {
    if (custom.delete(entry.id)) persistCustom();
    return;
  }
  custom.set(entry.id, entry);
  persistCustom();
}

/** All user-captured custom words and overrides — for cloud sync (see
 *  lib/cloudState). */
export function getCustomEntries(): DictionaryEntry[] {
  return Array.from(custom.values());
}

/** Replaces the custom-word cache (used when merging remote + local on
 *  login). Mirrors addCustomEntry's guard exactly: a bundled word is only
 *  kept when its content actually overrides the dictionary's default, so a
 *  synced edit survives a fresh login and an ordinary bundled word doesn't
 *  come along for no reason. */
export function setCustomEntries(entries: DictionaryEntry[]): void {
  custom.clear();
  for (const e of entries) {
    if (!matchesBundledDefault(e)) custom.set(e.id, e);
  }
  persistCustom();
}

/** Exact lookup by typed Dutch word (dictionary ids are the lowercased word).
 *  Always resolves the WORD, with all its senses — picking among them is the
 *  caller's job, and it's a choice the learner makes rather than one made
 *  here. */
export function lookupLocal(term: string): DictionaryEntry | undefined {
  return resolveEntry(term.trim().toLowerCase());
}

/** Damerau-ish edit distance, capped at `max` (early exit on longer words). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let best = i;
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** Spelling suggestions for a term that wasn't found: prefix matches first,
 *  then close misspellings — edit distance 1 outright (a single typo is
 *  close enough on its own), edit distance 2 only when the candidate also
 *  shares the query's first letter.
 *
 *  Distance 2 alone was too loose: "gestegen" → "gisteren" is genuinely
 *  edit-distance 2 with no shared prefix and no shared meaning ("yesterday"
 *  for what should resolve as a form of "stijgen", to rise) — a
 *  confident-looking wrong guess offered next to a real deinflection hit,
 *  which is exactly the failure item 1 in recommendations.md is about.
 *  Requiring the first letter to match keeps genuine near-misses ("gestegn" →
 *  "gestegen") while dropping unrelated words that merely happen to be two
 *  edits away. (See recommendations.md item 3c.) */
export function suggestWords(term: string, max = 3): DictionaryEntry[] {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: DictionaryEntry[] = [];
  const seen = new Set<string>();

  for (const e of DICTIONARY) {
    if (out.length >= max) return out;
    if (e.id.startsWith(q) && e.id !== q && !seen.has(e.id)) {
      out.push(e);
      seen.add(e.id);
    }
  }
  for (const e of DICTIONARY) {
    if (out.length >= max) break;
    if (seen.has(e.id) || e.id === q) continue;
    if (editDistance(q, e.id, 1) <= 1) {
      out.push(e);
      seen.add(e.id);
    }
  }
  for (const e of DICTIONARY) {
    if (out.length >= max) break;
    if (seen.has(e.id) || e.id === q) continue;
    if (e.id[0] !== q[0]) continue;
    if (editDistance(q, e.id, 2) <= 2) {
      out.push(e);
      seen.add(e.id);
    }
  }
  return out;
}

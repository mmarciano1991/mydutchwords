/* Word sources — resolves a deck word id to displayable content.
   Most deck words reference the bundled dictionary; words captured via the
   online lookup (Add a word) don't exist there, so they're stored as custom
   entries in localStorage and resolved from a module cache here. The same
   storage now also holds a bundled word's content when the user picked a
   non-default sense for it at capture time (see entryForSense below) — an
   override, not a duplicate, since resolveEntry always prefers it. */
import { DICTIONARY, findEntry, indexOfEntry } from "../data/dictionary";
import { exampleAt } from "../data/examples";
import { extraSensesFor } from "../data/senses";
import type { DictionaryEntry, WordSense } from "./types";

const CUSTOM_KEY = "woordkast.customWords";

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

/** The bundled dictionary's own answer for `id` — never consults `custom`,
 *  so it's exactly what resolveEntry would return if this word had never
 *  been captured or edited. Used to build that ordinary answer, and to tell
 *  whether a save is actually different from it (see addCustomEntry): the
 *  raw dictionary entry alone isn't enough for that comparison, since it
 *  carries no example sentence of its own — see below — and a real edit's
 *  content has to be compared against the same thing a screen would show,
 *  not against a permanently-empty placeholder. */
function resolveBundled(id: string): DictionaryEntry | undefined {
  const bundled = findEntry(id);
  if (!bundled) return undefined;

  // Bundled entries carry no example sentence of their own — those load
  // separately (see data/examples) — so one is attached here if it has
  // arrived. Before then the entry reads exactly as a word without one,
  // which every screen already handles.
  const example = exampleAt(indexOfEntry(id));
  const base = example ? { ...bundled, ...example } : bundled;

  const extras = extraSensesFor(id);
  if (extras.length === 0) return base;
  const primary: WordSense = {
    english: base.english,
    example: base.example,
    exampleEn: base.exampleEn,
    gender: base.gender,
  };
  return { ...base, senses: [primary, ...extras] };
}

/** Bundled dictionary first, then user-captured custom words — except a
 *  custom entry wins outright when both exist: that's exactly the case
 *  where the user picked a non-default sense, or edited the translation,
 *  for a bundled word (see addCustomEntry), and their choice should stick
 *  on every later screen, not just at the moment of capture. Custom
 *  (online, or overridden) words carry their own complete content and pass
 *  straight through — no merge needed. */
export function resolveEntry(id: string): DictionaryEntry | undefined {
  return custom.get(id) ?? resolveBundled(id);
}

function persistCustom(): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(Array.from(custom.values())));
  } catch (err) {
    console.warn("[woordkast] could not save captured words — kept for this session only", err);
  }
}

/** Turns an entry plus one of its senses into the plain entry that gets
 *  saved — same id, that sense's own content, no senses array (it's only
 *  needed to render the picker, not to persist a choice). */
export function entryForSense(entry: DictionaryEntry, sense: WordSense): DictionaryEntry {
  return {
    id: entry.id,
    dutch: entry.dutch,
    english: sense.english,
    gender: sense.gender,
    example: sense.example,
    exampleEn: sense.exampleEn,
  };
}

/** Corrects a word already resolved somewhere (bundled, custom, or a sense
 *  override) — the general form of entryForSense's mechanism, for the
 *  ~14,190 words that never had a second sense to pick from in the first
 *  place. Article/deadline glosses can be subtly wrong without ever being
 *  ambiguous enough to warrant a picker; this is the fallback for those.
 *  Same storage, same guard, same sync as addCustomEntry — a no-op if the
 *  edit matches the current content exactly. Gender is left as-is: this
 *  form only edits the translation and its example. */
export function editEntry(id: string, edit: { english: string; example: string; exampleEn: string }): void {
  const current = resolveEntry(id);
  if (!current) return;
  addCustomEntry({ ...current, english: edit.english, example: edit.example, exampleEn: edit.exampleEn, senses: undefined });
}

/** True when `entry`'s content is indistinguishable from what resolveEntry
 *  would already return without it — the case where storing it would be a
 *  redundant copy of the dictionary rather than an actual override.
 *
 *  Compares every field a save can change, not just the gloss: a save that
 *  only edits the example (translation left exactly as the default) is a
 *  real edit too, and comparing english alone would silently drop it. A
 *  bundled default never carries a metIn (see types.ts) — the dictionary
 *  doesn't know where a user met a word — so any entry with one set is
 *  never "just the default", even when the rest matches exactly. */
function matchesBundledDefault(entry: DictionaryEntry): boolean {
  const base = resolveBundled(entry.id);
  return (
    base !== undefined &&
    base.english === entry.english &&
    base.example === entry.example &&
    base.exampleEn === entry.exampleEn &&
    entry.metIn === undefined
  );
}

/** Persists a word captured from the online lookup, a bundled word whose
 *  gloss the user picked from among several senses, or a bundled word whose
 *  translation or example was edited directly — so resolveEntry keeps
 *  returning exactly what was chosen. A no-op when the content matches the
 *  bundled dictionary's own default — true for the vast majority of
 *  captures — which keeps custom storage limited to words that actually
 *  need an override instead of a redundant copy of the whole dictionary.
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
 *  synced sense-pick or edit survives a fresh login and an ordinary bundled
 *  word doesn't come along for no reason. */
export function setCustomEntries(entries: DictionaryEntry[]): void {
  custom.clear();
  for (const e of entries) {
    if (!matchesBundledDefault(e)) custom.set(e.id, e);
  }
  persistCustom();
}

/** Exact lookup by typed Dutch word (dictionary ids are the lowercased word). */
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
 *  then close misspellings (edit distance ≤ 2) from the bundled dictionary. */
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
    if (editDistance(q, e.id, 2) <= 2) {
      out.push(e);
      seen.add(e.id);
    }
  }
  return out;
}

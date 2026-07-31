/* Word sources — resolves a deck word id to displayable content.
   Most deck words reference the bundled dictionary; words captured via the
   online lookup (Add a word) don't exist there, so they're stored as custom
   entries in localStorage and resolved from a module cache here. */
import { DICTIONARY, findEntry, indexOfEntry } from "../data/dictionary";
import { exampleAt } from "../data/examples";
import type { DictionaryEntry } from "./types";

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

/** Bundled dictionary first, then user-captured custom words.
 *
 *  Bundled entries carry no example sentence of their own — those load
 *  separately (see data/examples) — so one is attached here if it has
 *  arrived. Before then the entry reads exactly as a word without one, which
 *  every screen already handles. Custom (online-captured) words never have
 *  examples, so they pass straight through. */
export function resolveEntry(id: string): DictionaryEntry | undefined {
  const entry = findEntry(id);
  if (!entry) return custom.get(id);
  const example = exampleAt(indexOfEntry(id));
  return example ? { ...entry, ...example } : entry;
}

function persistCustom(): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(Array.from(custom.values())));
  } catch (err) {
    console.warn("[woordkast] could not save captured words — kept for this session only", err);
  }
}

/** Persists a word captured from the online lookup so the deck can resolve it.
 *  Bundled dictionary words resolve natively and are not duplicated here. */
export function addCustomEntry(entry: DictionaryEntry): void {
  if (findEntry(entry.id)) return;
  custom.set(entry.id, entry);
  persistCustom();
}

/** All user-captured custom words — for cloud sync (see lib/cloudState). */
export function getCustomEntries(): DictionaryEntry[] {
  return Array.from(custom.values());
}

/** Replaces the custom-word cache (used when merging remote + local on login).
 *  Bundled dictionary words are skipped — they resolve natively. */
export function setCustomEntries(entries: DictionaryEntry[]): void {
  custom.clear();
  for (const e of entries) {
    if (!findEntry(e.id)) custom.set(e.id, e);
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

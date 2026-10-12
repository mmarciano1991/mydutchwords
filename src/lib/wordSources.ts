/* Word sources — what a deck id resolves to.

   A deck id is a SENSE id from the server dictionary (lib/dictionary). The
   deck keeps a local copy of every sense in it — a snapshot with the
   article, forms, examples and synonyms a card or an exercise needs — so
   practice works offline and opens instantly. The same store holds:

     - edits: a learner's own translation or example, marked `userEdited`;
       a dictionary update never overwrites those fields;
     - personal words: saved with the learner's own translation when the
       dictionary had nothing (`personal`);
     - legacy ids from before the server dictionary ("aanslag",
       "aanslag#1"), pinned to the content they had (data/legacy).

   The store is synced to the learner's account (lib/cloudState). */
import { useSyncExternalStore } from "react";
import { dictionarySource } from "./dictionary/service";
import { entryOf, snapshotOf } from "./dictionary/snapshot";
import type { WordEntry } from "./dictionary/model";
import type { DictionaryEntry } from "./types";

const STORE_KEY = "woordkast.customWords";

function load(): Map<string, DictionaryEntry> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as DictionaryEntry[]) : [];
    if (!Array.isArray(list)) return new Map();
    return new Map(list.map((e) => [e.id, e]));
  } catch (err) {
    console.warn("[woordkast] could not read saved words — starting empty", err);
    return new Map();
  }
}

const store = load();

/* The store lives outside React state, so changes are announced: a version
   that moves on every change, and listeners. */
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A number that changes whenever a stored entry changes — a dependency for
 *  anything derived from resolveEntry. */
export function useCustomEntriesVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

function persist(): void {
  version++;
  for (const notify of listeners) notify();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(store.values())));
  } catch (err) {
    console.warn("[woordkast] could not save words — kept for this session only", err);
  }
}

// ── Legacy ids ──

type LegacyModule = typeof import("../data/legacy/resolve");
let legacy: LegacyModule | null = null;
let legacyLoading: Promise<void> | null = null;

/** True for an id saved before the server dictionary. New sense ids start
 *  with "s_" (dictionary), "c_" (a reconstructed compound), "p_" (personal)
 *  or "o_" (the online dictionary). */
export function isLegacyId(id: string): boolean {
  return !/^[scpo]_/.test(id);
}

/** Pins every legacy id among `ids` that has no stored content yet, loading
 *  the frozen legacy dictionary once to do it. */
export function pinLegacyEntries(ids: string[]): Promise<void> {
  const missing = ids.filter((id) => isLegacyId(id) && !store.has(id));
  if (!missing.length) return Promise.resolve();
  legacyLoading ??= import("../data/legacy/resolve").then(async (m) => {
    // Examples first: a card read before they arrive would show without one.
    await m.ready();
    legacy = m;
  });
  return legacyLoading.then(() => {
    let changed = false;
    for (const id of missing) {
      const entry = legacy?.legacyEntry(id);
      if (entry && !store.has(id)) {
        store.set(id, entry);
        changed = true;
      }
    }
    if (changed) persist();
  });
}

// ── Reading ──

/** The entry for a deck id, or undefined while it can't be resolved (a
 *  legacy id before pinLegacyEntries has run, or an id that was never
 *  stored). */
export function resolveEntry(id: string): DictionaryEntry | undefined {
  return store.get(id) ?? (legacy ? legacy.legacyEntry(id) : undefined);
}

// ── Writing ──

/** Stores a sense as the deck will see it — called when it is added. */
export function addCustomEntry(entry: DictionaryEntry): void {
  const existing = store.get(entry.id);
  // An existing edit survives a re-add of the same sense.
  store.set(entry.id, existing?.userEdited?.length ? mergeKeepingEdits(entry, existing) : entry);
  persist();
}

/** The learner's correction of a saved sense: same id, same progress. The
 *  edited fields are marked so no dictionary update overwrites them. */
export function editEntry(id: string, edit: { english: string; example: string; exampleEn: string }): void {
  const current = resolveEntry(id);
  if (!current) return;
  const changed = (["english", "example", "exampleEn"] as const).filter((k) => current[k] !== edit[k]);
  if (!changed.length) return;
  const userEdited = [...new Set([...(current.userEdited ?? []), ...changed])];
  let snapshot = current.snapshot;
  if (snapshot) {
    const examples = [...snapshot.examples];
    if (changed.includes("example") || changed.includes("exampleEn")) {
      // The learner's own example replaces the first one; its target is
      // found again, and it is marked as theirs.
      examples[0] = { nl: edit.example, en: edit.exampleEn, targetSpans: [], source: "user" };
      if (!edit.example.trim()) examples.shift();
    }
    snapshot = { ...snapshot, gloss: edit.english, examples };
  }
  store.set(id, { ...current, ...edit, userEdited, snapshot });
  persist();
}

function mergeKeepingEdits(fresh: DictionaryEntry, old: DictionaryEntry): DictionaryEntry {
  const kept: Partial<DictionaryEntry> = {};
  for (const f of old.userEdited ?? []) kept[f] = old[f];
  const snapshot = fresh.snapshot && old.snapshot
    ? {
        ...fresh.snapshot,
        gloss: old.userEdited?.includes("english") ? old.snapshot.gloss : fresh.snapshot.gloss,
        examples: old.userEdited?.some((f) => f !== "english") ? old.snapshot.examples : fresh.snapshot.examples,
      }
    : fresh.snapshot;
  return { ...fresh, ...kept, userEdited: old.userEdited, metIn: old.metIn ?? fresh.metIn, snapshot };
}

/** Refreshes the stored copy of every dictionary sense among `ids` from the
 *  server — new examples, corrected glosses — keeping whatever the learner
 *  edited. A sense the dictionary no longer has keeps its stored copy. */
export async function refreshEntries(ids: string[], signal?: AbortSignal): Promise<number> {
  const senseIds = ids.filter((id) => id.startsWith("s_") && store.get(id)?.snapshot);
  if (!senseIds.length) return 0;
  const words: WordEntry[] = await dictionarySource().wordsForSenses(senseIds, signal);
  let changed = 0;
  for (const word of words) {
    for (const use of word.uses) {
      for (const sense of use.senses) {
        const old = store.get(sense.id);
        if (!old) continue;
        const fresh = { ...entryOf(snapshotOf(word, use, sense)), metIn: old.metIn };
        const merged = old.userEdited?.length ? mergeKeepingEdits(fresh, old) : fresh;
        if (JSON.stringify(merged) !== JSON.stringify(old)) {
          store.set(sense.id, merged);
          changed++;
        }
      }
    }
  }
  if (changed) persist();
  return changed;
}

// ── Sync ──

/** Everything stored — for cloud sync (see lib/cloudState). */
export function getCustomEntries(): DictionaryEntry[] {
  return Array.from(store.values());
}

/** Replaces the store (merging remote and local on login). */
export function setCustomEntries(entries: DictionaryEntry[]): void {
  store.clear();
  for (const e of entries) store.set(e.id, e);
  persist();
}

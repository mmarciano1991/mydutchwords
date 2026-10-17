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
       "aanslag#1"), pinned to the content they had (lib/legacyDictionary).

   The store is synced to the learner's account (lib/cloudState). */
import { useSyncExternalStore } from "react";
import { dictionarySource, lookup, type WordMatch } from "./dictionary/service";
import { articleOf, articleUnverified, entryOf, snapshotOf } from "./dictionary/snapshot";
import type { Pos, Sense, Use, WordEntry } from "./dictionary/model";
import { requestExample } from "./exampleService";
import type { DictionaryEntry } from "./types";
import { legacyEntries } from "./legacyDictionary";

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

/** True for an id saved before the server dictionary. New sense ids start
 *  with "s_" (dictionary), "c_" (a reconstructed compound), "p_" (personal)
 *  or "o_" (the online dictionary). */
export function isLegacyId(id: string): boolean {
  return !/^[scpo]_/.test(id);
}

/** Pins every legacy id among `ids` that has no stored content yet, from
 *  the frozen legacy dictionary (lib/legacyDictionary — fetched only when
 *  there is something to pin). */
export async function pinLegacyEntries(ids: string[]): Promise<void> {
  const missing = ids.filter((id) => isLegacyId(id) && !store.has(id));
  if (!missing.length) return;
  const found = await legacyEntries(missing);
  let changed = false;
  for (const [id, entry] of found) {
    if (!store.has(id)) {
      store.set(id, entry);
      changed = true;
    }
  }
  if (changed) persist();
}

// ── Reading ──

/** The entry for a deck id, or undefined while it can't be resolved (a
 *  legacy id before pinLegacyEntries has run, or an id that was never
 *  stored). */
export function resolveEntry(id: string): DictionaryEntry | undefined {
  return store.get(id);
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
        let snapshot = snapshotOf(word, use, sense);
        // An example written on demand (fillMissingExamples) stays until the
        // dictionary ships one of its own.
        const generated = old.snapshot?.examples[0];
        if (!snapshot.examples.length && generated?.source === "generated") snapshot = { ...snapshot, examples: [generated] };
        const fresh = { ...entryOf(snapshot), metIn: old.metIn, exampleRequestedAt: old.exampleRequestedAt };
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

/** The core of a gloss, for comparing one with another: "To wash (clothes)"
 *  → "wash (clothes)" → "wash". */
function glossCore(gloss: string): string {
  return gloss
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/^\s*to\s+/, "")
    .replace(/[!?.]+$/, "")
    .trim();
}

/** The part of speech an entry with no snapshot most likely has, from what
 *  its form looks up to; null when the dictionary can't tell. Only the word
 *  itself counts (not "liep" → lopen). With several, the gloss saved on the
 *  card picks the use, then "to …" means a verb; still unclear → null, never
 *  a guess. */
export function posFromMatches(entry: Pick<DictionaryEntry, "english">, matches: WordMatch[]): Pos | null {
  const uses = matches.filter((m) => m.via === "lemma" || m.via === "variant").flatMap((m) => m.word.uses);
  const all = [...new Set(uses.map((u) => u.pos))];
  if (all.length <= 1) return all[0] ?? null;
  const parts = new Set(entry.english.split(/[,;/]/).map(glossCore).filter(Boolean));
  const byGloss = [...new Set(uses.filter((u) => u.senses.some((s) => parts.has(glossCore(s.gloss)))).map((u) => u.pos))];
  if (byGloss.length === 1) return byGloss[0];
  if (/^\s*to\s/i.test(entry.english) && (byGloss.length ? byGloss : all).includes("verb")) return "verb";
  return null;
}

/** Finds the part of speech of every entry among `ids` that has no snapshot
 *  (cards saved before the server dictionary), so its card can show it. A
 *  card with de/het already reads as a noun; personal words aren't in the
 *  dictionary. A lookup that fails is tried again next launch. */
export async function fillMissingPos(ids: string[], signal?: AbortSignal): Promise<number> {
  const todo = ids
    .map((id) => store.get(id))
    .filter((e): e is DictionaryEntry => !!e && !e.snapshot && !e.personal && e.pos === undefined && e.gender !== "de" && e.gender !== "het");
  let changed = 0;
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8);
    const found = await Promise.all(
      batch.map((e) =>
        lookup(e.dutch, { signal }).then(
          (r) => posFromMatches(e, r.matches),
          () => undefined
        )
      )
    );
    batch.forEach((e, j) => {
      const pos = found[j];
      const current = store.get(e.id);
      if (pos === undefined || !current) return;
      store.set(e.id, { ...current, pos });
      changed++;
    });
    if (signal?.aborted) break;
  }
  if (changed) persist();
  return changed;
}

/** How long before a card the dictionary couldn't complete is tried again —
 *  a rebuilt dictionary may have its example by then. */
export const DETAILS_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

/** The one dictionary sense a card with no snapshot stands for: a sense of
 *  the word itself (not of an inflected form) whose gloss matches the card's.
 *  Null when none or several do — the card is then left as it is, never
 *  completed from a guess. */
export function matchingSense(entry: Pick<DictionaryEntry, "english">, matches: WordMatch[]): { use: Use; sense: Sense } | null {
  const parts = new Set(entry.english.split(/[,;/]/).map(glossCore).filter(Boolean));
  const hits = new Map<string, { use: Use; sense: Sense }>();
  for (const m of matches) {
    if (m.via !== "lemma" && m.via !== "variant") continue;
    for (const use of m.word.uses) {
      if (m.useIds && !m.useIds.includes(use.id)) continue;
      for (const sense of use.senses) {
        if (sense.gloss.split(/[,;/]/).some((g) => parts.has(glossCore(g)))) hits.set(sense.id, { use, sense });
      }
    }
  }
  return hits.size === 1 ? [...hits.values()][0] : null;
}

/** `entry` with what it lacks taken from its dictionary sense: an example
 *  (with its translation) when it has none, a noun's article when it is
 *  unknown and the dictionary's is verified, the part of speech when it was
 *  never looked up. Nothing it has, and nothing the learner edited, is
 *  replaced. Null when there is nothing to add. */
export function completedEntry(entry: DictionaryEntry, { use, sense }: { use: Use; sense: Sense }): DictionaryEntry | null {
  const edited = new Set(entry.userEdited ?? []);
  let next = entry;
  const example = sense.examples.find((e) => e.nl.trim() && e.en.trim());
  if (example && !entry.example.trim() && !edited.has("example") && !edited.has("exampleEn")) {
    next = {
      ...next,
      example: example.nl,
      exampleEn: example.en,
      senses: next.senses.map((s, i) => (i === 0 ? { ...s, example: example.nl, exampleEn: example.en, provisional: undefined } : s)),
    };
  }
  const article = use.pos === "noun" && !articleUnverified(use) ? articleOf(use, sense) : undefined;
  if (entry.gender === "unknown" && (article === "de" || article === "het")) {
    next = { ...next, gender: article, senses: next.senses.map((s, i) => (i === 0 ? { ...s, gender: article } : s)) };
  }
  if (entry.pos === undefined) next = { ...next, pos: use.pos };
  return next === entry ? null : next;
}

/** Completes every card among `ids` saved before the server dictionary (no
 *  snapshot, so refreshEntries never reaches it) that lacks an example or a
 *  noun's article, from the dictionary sense it unambiguously stands for.
 *  A card that can't be completed is tried again after DETAILS_RETRY_MS, and
 *  keeps showing its honest gap meanwhile ("Example coming soon"). */
export async function fillMissingDetails(ids: string[], signal?: AbortSignal, now = Date.now()): Promise<number> {
  const todo = ids
    .map((id) => store.get(id))
    .filter(
      (e): e is DictionaryEntry =>
        !!e && !e.snapshot && !e.personal && (!e.example.trim() || e.gender === "unknown") && now - (e.detailsCheckedAt ?? 0) >= DETAILS_RETRY_MS
    );
  let changed = 0;
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8);
    const found = await Promise.all(
      batch.map((e) =>
        lookup(e.dutch, { signal }).then(
          (r) => matchingSense(e, r.matches),
          () => undefined
        )
      )
    );
    batch.forEach((e, j) => {
      const hit = found[j];
      const current = store.get(e.id);
      // A failed lookup is tried again next launch.
      if (hit === undefined || !current) return;
      const completed = hit ? completedEntry(current, hit) : null;
      store.set(e.id, { ...(completed ?? current), detailsCheckedAt: now });
      changed++;
    });
    if (signal?.aborted) break;
  }
  if (changed) persist();
  return changed;
}

/** At most this many examples are asked for per call — the first cards of a
 *  big import fill now, the rest on later launches. */
export const EXAMPLES_PER_RUN = 12;

/** Gives every dictionary sense among `ids` that has no example one, from
 *  the "example" function (lib/exampleService): written once per sense on
 *  the server and shared by every learner. Personal words, cards whose
 *  example the learner edited, and cards from before the server dictionary
 *  are left alone. A sense the server has no example for is asked again
 *  after DETAILS_RETRY_MS; one that couldn't be reached, next time. */
export async function fillMissingExamples(ids: string[], signal?: AbortSignal, now = Date.now()): Promise<number> {
  const todo = ids
    .map((id) => store.get(id))
    .filter(
      (e): e is DictionaryEntry =>
        !!e?.snapshot &&
        !e.personal &&
        !e.example.trim() &&
        !e.userEdited?.some((f) => f !== "english") &&
        now - (e.exampleRequestedAt ?? 0) >= DETAILS_RETRY_MS
    )
    .slice(0, EXAMPLES_PER_RUN);
  let changed = 0;
  for (let i = 0; i < todo.length && !signal?.aborted; i += 3) {
    const batch = todo.slice(i, i + 3);
    const results = await Promise.all(batch.map((e) => requestExample(e.snapshot!.senseId, signal)));
    batch.forEach((e, j) => {
      const result = results[j];
      const current = store.get(e.id);
      if (result.kind === "offline" || !current?.snapshot) return;
      if (result.kind === "none" || current.example.trim()) {
        store.set(e.id, { ...current, exampleRequestedAt: now });
      } else {
        const fresh = { ...entryOf({ ...current.snapshot, examples: [result.example] }), metIn: current.metIn, exampleRequestedAt: now };
        store.set(e.id, current.userEdited?.length ? mergeKeepingEdits(fresh, current) : fresh);
      }
      changed++;
    });
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

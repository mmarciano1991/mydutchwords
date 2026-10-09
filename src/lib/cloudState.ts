/* Cloud state — the syncable snapshot of a user's progress (deck +
   practice results + custom words), plus an offline-first merge and the
   read/write helpers against the `user_state` table.

   Merge philosophy (no server clock, two offline-capable devices): union
   everything by identity and, on a per-word conflict, keep the copy graded
   most recently (both sides migrated to the current engine first). Results are an append-only event log, so their union
   (deduped) is lossless. This can resurrect a word deleted on one device
   only — an accepted trade-off for a simple, data-preserving sync. */
import { runAnswerCount, type PracticeRun } from "./dailySet";
import { mergeHabit, normalizeHabit, type HabitState } from "./habit";
import { migrateDeck } from "./storage";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./types";
import { supabase } from "./supabase";

const TABLE = "user_state";

export interface AppState {
  deck: DeckItem[];
  results: PracticeResult[];
  customWords: DictionaryEntry[];
  /** The current (or last) run through a set of words — what the dashboard's
   *  practice card reports. Null before the first practice. */
  run: PracticeRun | null;
  /** The daily commitment, cue, weekly target and the days done. Null until
   *  onboarding has been completed. Optional so snapshots saved before it
   *  existed still read as valid. */
  habit?: HabitState | null;
}

/** How much evidence a deck item carries — the tie-break after recency. */
function evidenceScore(d: DeckItem): number {
  return (d.successfulReviewDays ?? 0) + (d.lapses ?? 0) + (d.consecutiveFailures ?? 0);
}

/** ISO review timestamp as millis (0 when never reviewed). */
function reviewedAt(d: DeckItem): number {
  return d.lastReviewedAt ? new Date(d.lastReviewedAt).getTime() : 0;
}

/** Of two copies of the same word, the one graded most recently: a word's
 *  state is the result of its answers in order, so the copy that saw the
 *  later answer is the later state. Ties → more evidence, then most
 *  recently added, then the first argument. */
function pickDeckItem(a: DeckItem, b: DeckItem): DeckItem {
  const at = reviewedAt(a);
  const bt = reviewedAt(b);
  if (at !== bt) return bt > at ? b : a;
  const byEvidence = evidenceScore(b) - evidenceScore(a);
  if (byEvidence !== 0) return byEvidence > 0 ? b : a;
  return b.dateAdded > a.dateAdded ? b : a;
}

/** The run to keep. Newer day wins; within a day, the one that got further.
 *  Runs are not unioned: each is one sitting's record, and blending two
 *  would invent a session that never happened. */
function pickRun(a: PracticeRun | null, b: PracticeRun | null): PracticeRun | null {
  if (!a) return b;
  if (!b) return a;
  if (a.date !== b.date) return a.date > b.date ? a : b;
  const answered = runAnswerCount(b) - runAnswerCount(a);
  if (answered !== 0) return answered > 0 ? b : a;
  // Same answers given: the one that was finished.
  return b.completedAt && !a.completedAt ? b : a;
}

/** Offline-first union of two snapshots. Pure; order-independent per word. */
export function mergeState(a: AppState, b: AppState, now: Date = new Date()): AppState {
  // Results — union of the event log, deduped by (word, time, grade).
  const results = new Map<string, PracticeResult>();
  for (const r of [...a.results, ...b.results]) {
    results.set(`${r.entryId}|${r.timestamp}|${r.grade}`, r);
  }
  const allResults = [...results.values()];

  // Deck — union by id, keeping the later-graded copy on conflict. Either
  // side may come from a client older than the current engine, so both are
  // migrated first (a no-op for words already migrated).
  const deck = new Map<string, DeckItem>();
  for (const item of [...migrateDeck(a.deck, allResults, now), ...migrateDeck(b.deck, allResults, now)]) {
    const existing = deck.get(item.id);
    deck.set(item.id, existing ? pickDeckItem(existing, item) : item);
  }

  // Custom words — union by id (content is identical for a given id).
  const custom = new Map<string, DictionaryEntry>();
  for (const e of [...a.customWords, ...b.customWords]) {
    if (!custom.has(e.id)) custom.set(e.id, e);
  }

  return {
    deck: [...deck.values()].sort((x, y) => y.dateAdded - x.dateAdded),
    results: allResults.sort((x, y) => x.timestamp - y.timestamp),
    customWords: [...custom.values()],
    run: pickRun(a.run, b.run),
    habit: mergeHabit(a.habit ?? null, b.habit ?? null),
  };
}

/** Result of a remote-state fetch. `ok: false` means the fetch itself failed
 *  (network/RLS/timeout) — distinct from `ok: true, state: null`, which means
 *  the request succeeded and the user genuinely has no saved snapshot yet.
 *  Callers must not treat a failed fetch the same as "no data": doing so
 *  would let a merge fall back to local-only state and then push that over
 *  a real remote snapshot it never actually saw. */
export type RemoteFetchResult = { ok: true; state: AppState | null } | { ok: false };

/* The habit column arrived in a later migration than the app code that reads
   it. Until it is applied, a select or upsert naming it fails outright —
   which would stall hydration (retried forever) and stop all progress from
   saving. So a missing-column error switches the column off for the rest of
   the session and the request is retried without it: everything else keeps
   syncing, and the habit simply stays on the device. */
let habitColumn = true;

/** Postgres "undefined column", or PostgREST's schema-cache equivalent. */
function isMissingHabitColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (error.code === "42703" || error.code === "PGRST204") && /habit/.test(error.message ?? "");
}

/** The signed-in user's saved snapshot. Never throws. */
export async function fetchRemoteState(userId: string): Promise<RemoteFetchResult> {
  if (!supabase) return { ok: true, state: null };
  try {
    // Typed as plain strings: the column list is chosen at runtime, which
    // the client's select-string parser can't type, so rows come back as
    // records and each field is cast below as before.
    const columns: string = "deck, results, custom_words, practice_run";
    const fetchRow = (cols: string) =>
      supabase!.from(TABLE).select(cols).eq("user_id", userId).maybeSingle<Record<string, unknown>>();
    let { data, error } = await fetchRow(habitColumn ? `${columns}, habit` : columns);
    if (habitColumn && isMissingHabitColumn(error)) {
      habitColumn = false;
      ({ data, error } = await fetchRow(columns));
    }
    if (error) return { ok: false };
    if (!data) return { ok: true, state: null };
    return {
      ok: true,
      state: {
        deck: (data.deck as DeckItem[]) ?? [],
        results: (data.results as PracticeResult[]) ?? [],
        customWords: (data.custom_words as DictionaryEntry[]) ?? [],
        run: (data.practice_run as PracticeRun | null) ?? null,
        habit: normalizeHabit(data.habit),
      },
    };
  } catch {
    return { ok: false };
  }
}

/** Upserts the snapshot for a user. Resolves false on failure (never throws). */
export async function pushState(userId: string, state: AppState): Promise<boolean> {
  if (!supabase) return false;
  try {
    const row: Record<string, unknown> = {
      user_id: userId,
      deck: state.deck,
      results: state.results,
      custom_words: state.customWords,
      practice_run: state.run,
      updated_at: new Date().toISOString(),
    };
    if (habitColumn) row.habit = state.habit ?? null;
    let { error } = await supabase.from(TABLE).upsert(row, { onConflict: "user_id" });
    if (habitColumn && isMissingHabitColumn(error)) {
      habitColumn = false;
      delete row.habit;
      ({ error } = await supabase.from(TABLE).upsert(row, { onConflict: "user_id" }));
    }
    return !error;
  } catch {
    return false;
  }
}

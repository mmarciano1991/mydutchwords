/* Cloud state — the syncable snapshot of a user's progress (deck +
   practice results + custom words), plus an offline-first merge and the
   read/write helpers against the `user_state` table.

   Merge philosophy (no server clock, two offline-capable devices): union
   everything by identity and, on a per-word conflict, keep the copy that
   has practised more. Results are an append-only event log, so their union
   (deduped) is lossless. This can resurrect a word deleted on one device
   only — an accepted trade-off for a simple, data-preserving sync. */
import { runAnswerCount, type DailySet, type PracticeRun } from "./dailySet";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./types";
import { supabase } from "./supabase";

const TABLE = "user_state";

export interface AppState {
  deck: DeckItem[];
  results: PracticeResult[];
  customWords: DictionaryEntry[];
  /** The day's drawn practice set, or null before the first one. */
  dailySet: DailySet | null;
  /** The current (or last) run through a set of words — what the dashboard's
   *  practice card reports. Null before the first practice. */
  run: PracticeRun | null;
}

/** How much practice history a deck item carries — higher wins a conflict. */
function progressScore(d: DeckItem): number {
  return (d.reps ?? 0) + (d.lapses ?? 0);
}

/** ISO review timestamp as millis (0 when never reviewed). */
function reviewedAt(d: DeckItem): number {
  return d.lastReviewedAt ? new Date(d.lastReviewedAt).getTime() : 0;
}

/** The more-practised of two copies of the same word (ties → most recently
 *  reviewed, then most recently added, then the first argument). */
function pickDeckItem(a: DeckItem, b: DeckItem): DeckItem {
  const byProgress = progressScore(b) - progressScore(a);
  if (byProgress !== 0) return byProgress > 0 ? b : a;
  const at = reviewedAt(a);
  const bt = reviewedAt(b);
  if (at !== bt) return bt > at ? b : a;
  return b.dateAdded > a.dateAdded ? b : a;
}

/** The daily set to keep. A newer date always wins — yesterday's draw is
 *  spent. Within the same day, an empty draw carries no information: a
 *  device that had nothing to draw yet (a deck that hasn't synced) must not
 *  overwrite the real set. */
function pickDailySet(a: DailySet | null, b: DailySet | null): DailySet | null {
  if (!a) return b;
  if (!b) return a;
  if (a.date !== b.date) return a.date > b.date ? a : b;
  if (a.wordIds.length === 0) return b;
  if (b.wordIds.length === 0) return a;
  return a;
}

/** The run to keep. Newer day wins; within a day, the one that got further.
 *  Runs are not unioned: each is one sitting's record, and blending two
 *  would invent a session that never happened. */
function pickRun(a: PracticeRun | null, b: PracticeRun | null): PracticeRun | null {
  if (!a) return b;
  if (!b) return a;
  if (a.date !== b.date) return a.date > b.date ? a : b;
  return runAnswerCount(b) > runAnswerCount(a) ? b : a;
}

/** Offline-first union of two snapshots. Pure; order-independent per word. */
export function mergeState(a: AppState, b: AppState): AppState {
  // Deck — union by id, keeping the more-practised copy on conflict.
  const deck = new Map<string, DeckItem>();
  for (const item of [...a.deck, ...b.deck]) {
    const existing = deck.get(item.id);
    deck.set(item.id, existing ? pickDeckItem(existing, item) : item);
  }

  // Results — union of the event log, deduped by (word, time, grade).
  const results = new Map<string, PracticeResult>();
  for (const r of [...a.results, ...b.results]) {
    results.set(`${r.entryId}|${r.timestamp}|${r.grade}`, r);
  }

  // Custom words — union by id (content is identical for a given id).
  const custom = new Map<string, DictionaryEntry>();
  for (const e of [...a.customWords, ...b.customWords]) {
    if (!custom.has(e.id)) custom.set(e.id, e);
  }

  return {
    deck: [...deck.values()].sort((x, y) => y.dateAdded - x.dateAdded),
    results: [...results.values()].sort((x, y) => x.timestamp - y.timestamp),
    customWords: [...custom.values()],
    dailySet: pickDailySet(a.dailySet, b.dailySet),
    run: pickRun(a.run, b.run),
  };
}

/** Result of a remote-state fetch. `ok: false` means the fetch itself failed
 *  (network/RLS/timeout) — distinct from `ok: true, state: null`, which means
 *  the request succeeded and the user genuinely has no saved snapshot yet.
 *  Callers must not treat a failed fetch the same as "no data": doing so
 *  would let a merge fall back to local-only state and then push that over
 *  a real remote snapshot it never actually saw. */
export type RemoteFetchResult = { ok: true; state: AppState | null } | { ok: false };

/** The signed-in user's saved snapshot. Never throws. */
export async function fetchRemoteState(userId: string): Promise<RemoteFetchResult> {
  if (!supabase) return { ok: true, state: null };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("deck, results, custom_words, daily_set, practice_run")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { ok: false };
    if (!data) return { ok: true, state: null };
    return {
      ok: true,
      state: {
        deck: (data.deck as DeckItem[]) ?? [],
        results: (data.results as PracticeResult[]) ?? [],
        customWords: (data.custom_words as DictionaryEntry[]) ?? [],
        dailySet: (data.daily_set as DailySet | null) ?? null,
        run: (data.practice_run as PracticeRun | null) ?? null,
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
    const { error } = await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        deck: state.deck,
        results: state.results,
        custom_words: state.customWords,
        daily_set: state.dailySet,
        practice_run: state.run,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

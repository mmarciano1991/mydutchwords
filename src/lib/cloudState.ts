/* Cloud state — the syncable snapshot of a user's progress (deck +
   practice results + custom words), plus an offline-first merge and the
   read/write helpers against the `user_state` table.

   Merge philosophy (no server clock, two offline-capable devices): union
   everything by identity and, on a per-word conflict, keep the copy that
   has practised more. Results are an append-only event log, so their union
   (deduped) is lossless. This can resurrect a word deleted on one device
   only — an accepted trade-off for a simple, data-preserving sync. */
import type { DeckItem, DictionaryEntry, PracticeResult } from "./types";
import { supabase } from "./supabase";

const TABLE = "user_state";

export interface AppState {
  deck: DeckItem[];
  results: PracticeResult[];
  customWords: DictionaryEntry[];
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
  };
}

/** The signed-in user's saved snapshot, or null if they have none yet.
 *  Returns null (not throw) on any failure so sync never breaks the app. */
export async function fetchRemoteState(userId: string): Promise<AppState | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("deck, results, custom_words")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      deck: (data.deck as DeckItem[]) ?? [],
      results: (data.results as PracticeResult[]) ?? [],
      customWords: (data.custom_words as DictionaryEntry[]) ?? [],
    };
  } catch {
    return null;
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

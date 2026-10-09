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
    results.set(resultKey(r), r);
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

/** Identity of a practice result — the key the merge (and the server-side
 *  append) dedupes on. */
export function resultKey(r: PracticeResult): string {
  return `${r.entryId}|${r.timestamp}|${r.grade}`;
}

/** Where this device's copy stands relative to the server.
 *
 *  `version` is the row version the device last saw (0 = no row yet), or null
 *  when the server predates versioning — then writes fall back to a plain
 *  upsert. `serverResults` holds the keys of the results known to be stored
 *  already, so a push only sends the ones that aren't. */
export interface SyncBase {
  version: number | null;
  serverResults: Set<string>;
}

/** Result of a remote-state fetch. `ok: false` means the fetch itself failed
 *  (network/RLS/timeout) — distinct from `ok: true, state: null`, which means
 *  the request succeeded and the user genuinely has no saved snapshot yet.
 *  Callers must not treat a failed fetch the same as "no data": doing so
 *  would let a merge fall back to local-only state and then push that over
 *  a real remote snapshot it never actually saw. */
export type RemoteFetchResult = { ok: true; state: AppState | null; version: number | null } | { ok: false };

/** A stored row as app state, and its version (null on a pre-versioning
 *  schema). */
function fromRow(row: Record<string, unknown>): { state: AppState; version: number | null } {
  return {
    state: {
      deck: (row.deck as DeckItem[]) ?? [],
      results: (row.results as PracticeResult[]) ?? [],
      customWords: (row.custom_words as DictionaryEntry[]) ?? [],
      run: (row.practice_run as PracticeRun | null) ?? null,
      habit: normalizeHabit(row.habit),
    },
    version: typeof row.version === "number" ? row.version : null,
  };
}

/** The signed-in user's saved snapshot. Never throws.
 *
 *  Selects `*` rather than naming columns, so a column added by a migration
 *  that hasn't been applied yet (habit, version) reads as absent instead of
 *  failing the whole request. */
export async function fetchRemoteState(userId: string): Promise<RemoteFetchResult> {
  if (!supabase) return { ok: true, state: null, version: 0 };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<Record<string, unknown>>();
    if (error) return { ok: false };
    // No row: version 0, which is what the sync function expects for a first
    // write. (On a pre-versioning schema the function is missing and the
    // push falls back to an upsert anyway.)
    if (!data) return { ok: true, state: null, version: 0 };
    return { ok: true, ...fromRow(data) };
  } catch {
    return { ok: false };
  }
}

export type PushResult =
  /** Written. `version` is the row's new version (null on the upsert path). */
  | { status: "ok"; version: number | null }
  /** Not written: the server has moved on since `base.version`. `remote` is
   *  the current snapshot to merge before retrying. */
  | { status: "conflict"; remote: AppState | null; version: number }
  | { status: "error" };

/* Each fallback below covers a migration that may not be applied yet. They
   switch off for the rest of the session on the first miss, so the app keeps
   syncing — with fewer guarantees — instead of failing every write. */
let syncFunction = true;
let habitColumn = true;

/** PostgREST "function not found", or Postgres "undefined function". */
function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/** Postgres "undefined column", or PostgREST's schema-cache equivalent. */
function isMissingHabitColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (error.code === "42703" || error.code === "PGRST204") && /habit/.test(error.message ?? "");
}

/** Whole-snapshot upsert, for a server without the sync function.
 *  Last-write-wins: only safe-ish because hydration merged first. */
async function upsertState(userId: string, state: AppState): Promise<PushResult> {
  const row: Record<string, unknown> = {
    user_id: userId,
    deck: state.deck,
    results: state.results,
    custom_words: state.customWords,
    practice_run: state.run,
    updated_at: new Date().toISOString(),
  };
  if (habitColumn) row.habit = state.habit ?? null;
  let { error } = await supabase!.from(TABLE).upsert(row, { onConflict: "user_id" });
  if (habitColumn && isMissingHabitColumn(error)) {
    habitColumn = false;
    delete row.habit;
    ({ error } = await supabase!.from(TABLE).upsert(row, { onConflict: "user_id" }));
  }
  return error ? { status: "error" } : { status: "ok", version: null };
}

/** Writes the snapshot, provided the server is still at `base.version`.
 *  Never throws. */
export async function pushState(userId: string, state: AppState, base: SyncBase): Promise<PushResult> {
  if (!supabase) return { status: "error" };
  try {
    if (base.version === null || !syncFunction) return await upsertState(userId, state);

    const { data, error } = await supabase.rpc("sync_user_state", {
      p_expected_version: base.version,
      p_deck: state.deck,
      p_new_results: state.results.filter((r) => !base.serverResults.has(resultKey(r))),
      p_custom_words: state.customWords,
      // The daily set was replaced by practice runs (engine v2); the column
      // stays for old clients, cleared on this client's writes.
      p_daily_set: null,
      p_practice_run: state.run,
      p_habit: state.habit ?? null,
    });
    if (isMissingFunction(error)) {
      syncFunction = false;
      return await upsertState(userId, state);
    }
    if (error || !data) return { status: "error" };

    const reply = data as { status: string; version?: number; row?: Record<string, unknown> | null };
    if (reply.status === "ok") return { status: "ok", version: reply.version ?? null };
    if (reply.status === "conflict") {
      if (!reply.row) return { status: "conflict", remote: null, version: 0 };
      const { state: remote, version } = fromRow(reply.row);
      return { status: "conflict", remote, version: version ?? 0 };
    }
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

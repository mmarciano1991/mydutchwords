/* useCloudSync — keeps the signed-in user's progress in their Supabase
   profile, offline-first:

   - On login (or reload with a session), pull the remote snapshot, merge it
     with whatever is local (see cloudState.mergeState), apply the result to
     the app + localStorage, and push the merged snapshot back.
   - After that hydration, any local change is pushed (debounced). A push is
     only accepted against the row version this device last saw; when another
     device got there first, the push comes back as a conflict carrying the
     newer row, which is merged in, applied, and pushed again.
   - Pending changes are flushed as soon as the tab is hidden, since mobile
     browsers may never run the debounce timer again.
   - On logout, stop syncing but keep the local data — the app stays usable.

   Does nothing when cloud sync isn't configured or nobody is logged in. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DailySet, PracticeRun } from "./dailySet";
import type { HabitState } from "./habit";
import type { DeckItem, PracticeResult } from "./types";
import { getCustomEntries, setCustomEntries, useCustomEntriesVersion } from "./wordSources";
import {
  fetchRemoteState,
  mergeState,
  pushState,
  resultKey,
  type AppState,
  type SyncBase,
} from "./cloudState";
import { loadOwner, saveOwner } from "./storage";
import { supabase } from "./supabase";

const PUSH_DEBOUNCE_MS = 1200;
// How long to wait before re-trying a failed pull or push (network/RLS
// hiccup, most likely right after the OAuth redirect's cold page load).
// Retried indefinitely — until it succeeds, local edits stay unsynced but
// are never at risk, since nothing is pushed until the pull is known-good.
const RETRY_MS = 15_000;
// Conflicts in a row before giving up until the next change or retry. Each
// one means another device wrote in the moment between merge and push.
const MAX_CONFLICT_ROUNDS = 3;

const resultKeys = (results: PracticeResult[]) => new Set(results.map(resultKey));

const EMPTY_STATE: AppState = { deck: [], results: [], customWords: [], dailySet: null, run: null, habit: null };

export function useCloudSync({
  userId,
  deck,
  results,
  dailySet,
  run,
  habit,
  applyMerged,
}: {
  /** The signed-in user's id, or null when logged out / unconfigured. */
  userId: string | null;
  deck: DeckItem[];
  results: PracticeResult[];
  /** Today's drawn practice set, or null before the first draw. */
  dailySet: DailySet | null;
  /** The current or most recent practice run. */
  run: PracticeRun | null;
  /** The daily commitment and its history, or null before onboarding. */
  habit: HabitState | null;
  /** Applies a merged snapshot to app state (custom words are set here,
   *  before it is called). */
  applyMerged: (state: AppState) => void;
}): {
  hydrated: boolean;
  /** The first pull for this user failed and is being retried in the
   *  background — callers stop waiting for it. */
  hydrationFailed: boolean;
  /** Pushes now, waiting for any push already running. Resolves true once
   *  everything local is saved — or there is nothing to save to. */
  flush: () => Promise<boolean>;
} {
  // The user id whose initial pull+merge has completed. Pushing is gated on
  // this so a pre-merge local state can't clobber the remote during hydration.
  const hydratedFor = useRef<string | null>(null);
  // Mirrors hydratedFor for rendering: onboarding must not be shown to a
  // returning user just because their remote habit hasn't arrived yet.
  const [hydratedUser, setHydratedUser] = useState<string | null>(null);
  // The user whose first pull failed (offline, most likely) — waiting on it
  // any longer would only hold the screen blank.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const base = useRef<SyncBase>({ version: null, serverResults: new Set() });
  const inFlight = useRef<Promise<boolean> | null>(null);
  const pushTimer = useRef<number | undefined>(undefined);
  const retryTimer = useRef<number | undefined>(undefined);
  // A local change not yet handed to a push.
  const pending = useRef(false);

  const customVersion = useCustomEntriesVersion();

  // Always the current local state. Merges read it *after* awaiting the
  // network, so anything changed while a request was in flight is merged
  // rather than overwritten.
  const localRef = useRef({ deck, results, dailySet, run, habit });
  localRef.current = { deck, results, dailySet, run, habit };
  const snapshot = useCallback((): AppState => ({ ...localRef.current, customWords: getCustomEntries() }), []);

  const applyRef = useRef(applyMerged);
  applyRef.current = applyMerged;

  /** Merges a remote snapshot into the current local state and applies it.
   *  `discardLocal` takes the remote as it is — for local data that belongs
   *  to a different account. */
  const adopt = useCallback((remote: AppState | null, discardLocal = false): AppState => {
    const local = discardLocal ? EMPTY_STATE : snapshot();
    const merged = remote ? mergeState(local, remote) : local;
    setCustomEntries(merged.customWords);
    applyRef.current(merged);
    // Visible to the next push straight away, before React re-renders.
    localRef.current = {
      deck: merged.deck,
      results: merged.results,
      dailySet: merged.dailySet,
      run: merged.run,
      habit: merged.habit ?? null,
    };
    return merged;
  }, [snapshot]);

  /** One push, merging and retrying through conflicts. */
  const pushOnce = useCallback(
    async (uid: string): Promise<boolean> => {
      for (let round = 0; round < MAX_CONFLICT_ROUNDS; round++) {
        const sent = snapshot();
        const result = await pushState(uid, sent, base.current);
        if (hydratedFor.current !== uid) return false; // signed out meanwhile
        if (result.status === "error") return false;
        if (result.status === "ok") {
          const stored = base.current.serverResults;
          for (const r of sent.results) stored.add(resultKey(r));
          base.current = { version: result.version, serverResults: stored };
          return true;
        }
        base.current = { version: result.version, serverResults: resultKeys(result.remote?.results ?? []) };
        adopt(result.remote);
      }
      return false;
    },
    [adopt, snapshot]
  );

  const flush = useCallback(async (): Promise<boolean> => {
    if (!supabase || !userId) return true;
    if (hydratedFor.current !== userId) return false;
    window.clearTimeout(pushTimer.current);
    window.clearTimeout(retryTimer.current);
    // Pushes run one at a time: two at once would both claim the same base
    // version, and the second would always come back as a conflict.
    while (inFlight.current) await inFlight.current;
    pending.current = false;
    const push = pushOnce(userId);
    inFlight.current = push;
    try {
      const ok = await push;
      if (!ok && hydratedFor.current === userId) {
        retryTimer.current = window.setTimeout(() => void flush(), RETRY_MS);
      }
      return ok;
    } finally {
      inFlight.current = null;
    }
  }, [userId, pushOnce]);

  // Pull + merge + push once per login. A failed pull is retried rather than
  // treated as "no remote data" — conflating the two would let a merge fall
  // back to local-only state and then push it over a remote snapshot the
  // fetch never actually saw, destroying real progress on a transient error.
  useEffect(() => {
    if (!supabase || !userId || hydratedFor.current === userId) return;
    let cancelled = false;
    let timer: number | undefined;

    const attempt = async () => {
      const result = await fetchRemoteState(userId);
      if (cancelled) return;
      if (!result.ok) {
        setFailedFor(userId);
        timer = window.setTimeout(attempt, RETRY_MS);
        return;
      }
      base.current = { version: result.version, serverResults: resultKeys(result.state?.results ?? []) };
      // Local data synced with another account (its session expired rather
      // than being logged out, which would have wiped it) is that person's —
      // merging it would copy their deck into this account.
      const owner = loadOwner();
      adopt(result.state, owner !== null && owner !== userId);
      saveOwner(userId);
      hydratedFor.current = userId;
      setHydratedUser(userId);
      await flush();
    };
    void attempt();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Keyed on userId only: the local snapshot is read through localRef at
    // merge time, and ongoing changes go through the push effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Forget hydration on logout so the next login re-pulls and re-merges.
  useEffect(() => {
    if (userId) return;
    hydratedFor.current = null;
    base.current = { version: null, serverResults: new Set() };
    window.clearTimeout(pushTimer.current);
    window.clearTimeout(retryTimer.current);
    setHydratedUser(null);
  }, [userId]);

  // Debounced push of local changes, only after hydration for this user.
  useEffect(() => {
    if (!supabase || !userId || hydratedFor.current !== userId) return;
    pending.current = true;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void flush(), PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(pushTimer.current);
  }, [deck, results, dailySet, run, habit, customVersion, userId, flush]);

  // A hidden tab may never be resumed, so don't leave changes on the timer.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && pending.current) void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  // Without sync (unconfigured build, or nobody signed in) local state is
  // all there is, so it counts as hydrated straight away.
  return {
    hydrated: !supabase || !userId || hydratedUser === userId,
    hydrationFailed: Boolean(userId) && failedFor === userId,
    flush,
  };
}

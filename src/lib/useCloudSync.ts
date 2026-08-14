/* useCloudSync — keeps the signed-in user's progress in their Supabase
   profile, offline-first:

   - On login (or reload with a session), pull the remote snapshot, merge it
     with whatever is local (see cloudState.mergeState), apply the result to
     the app + localStorage, and push the merged snapshot back.
   - After that hydration, any local change is pushed (debounced) so progress
     is saved as the user practises.
   - On logout, stop syncing but keep the local data — the app stays usable.

   Does nothing when cloud sync isn't configured or nobody is logged in. */
import { useEffect, useRef } from "react";
import type { DeckItem, PracticeResult } from "./types";
import { getCustomEntries, setCustomEntries } from "./wordSources";
import { fetchRemoteState, mergeState, pushState, type AppState } from "./cloudState";
import { supabase } from "./supabase";

const PUSH_DEBOUNCE_MS = 1200;
// How long to wait before re-trying a failed initial pull (network/RLS
// hiccup, most likely right after the OAuth redirect's cold page load).
// Retried indefinitely — until it succeeds, local edits stay unsynced but
// are never at risk, since nothing is pushed until the pull is known-good.
const HYDRATE_RETRY_MS = 15_000;

export function useCloudSync({
  userId,
  deck,
  results,
  applyMerged,
}: {
  /** The signed-in user's id, or null when logged out / unconfigured. */
  userId: string | null;
  deck: DeckItem[];
  results: PracticeResult[];
  /** Applies a merged snapshot to app state (setDeck/setResults + custom words). */
  applyMerged: (state: AppState) => void;
}) {
  // The user id whose initial pull+merge has completed. Pushing is gated on
  // this so a pre-merge local state can't clobber the remote during hydration.
  const hydratedFor = useRef<string | null>(null);
  const pushTimer = useRef<number | undefined>(undefined);

  // Always the current local state. The merge below reads it *after* awaiting
  // the network, so anything added while that request was in flight is
  // merged rather than overwritten — capturing deck/results in the effect
  // closure silently discarded those edits.
  const localRef = useRef({ deck, results });
  localRef.current = { deck, results };

  // Pull + merge + push once per login. A failed pull is retried rather than
  // treated as "no remote data" — conflating the two would let a merge fall
  // back to local-only state and then push it over a remote snapshot the
  // fetch never actually saw, destroying real progress on a transient error.
  useEffect(() => {
    if (!supabase || !userId || hydratedFor.current === userId) return;
    let cancelled = false;
    let retryTimer: number | undefined;

    const attempt = async () => {
      const result = await fetchRemoteState(userId);
      if (cancelled) return;
      if (!result.ok) {
        retryTimer = window.setTimeout(attempt, HYDRATE_RETRY_MS);
        return;
      }
      const local: AppState = { ...localRef.current, customWords: getCustomEntries() };
      const merged = result.state ? mergeState(local, result.state) : local;
      setCustomEntries(merged.customWords);
      applyMerged(merged);
      hydratedFor.current = userId;
      await pushState(userId, merged);
    };
    void attempt();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
    // Intentionally keyed on userId only: the local snapshot is read through
    // localRef at merge time, and ongoing changes go through the push effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Forget hydration on logout so the next login re-pulls and re-merges.
  useEffect(() => {
    if (!userId) hydratedFor.current = null;
  }, [userId]);

  // Debounced push of local changes, only after hydration for this user.
  useEffect(() => {
    if (!supabase || !userId || hydratedFor.current !== userId) return;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      void pushState(userId, { deck, results, customWords: getCustomEntries() });
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(pushTimer.current);
  }, [deck, results, userId]);
}

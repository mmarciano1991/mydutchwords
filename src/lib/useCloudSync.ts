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

  // Pull + merge + push once per login.
  useEffect(() => {
    if (!supabase || !userId || hydratedFor.current === userId) return;
    let cancelled = false;
    (async () => {
      const remote = await fetchRemoteState(userId);
      if (cancelled) return;
      const local: AppState = { deck, results, customWords: getCustomEntries() };
      const merged = remote ? mergeState(local, remote) : local;
      setCustomEntries(merged.customWords);
      applyMerged(merged);
      hydratedFor.current = userId;
      await pushState(userId, merged);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on userId only: deck/results are read as the login
    // snapshot; ongoing changes are handled by the push effect below.
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

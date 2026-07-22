/* useLatestSearch — request lifecycle for an async lookup keyed by a query
   string. Guarantees, per UX best practice:
   - starting a new search aborts the in-flight one (no races, no stale data);
   - only the latest request's result is ever surfaced;
   - `slow` turns true only after `slowAfterMs`, so fast responses never
     flash a spinner;
   - successful results are cached per query — repeating a search answers
     instantly with no network call (errors are not cached, so retry works);
   - a cancelled request never becomes an error state;
   - everything (controller, timer) is cleaned up on unmount. */
import { useCallback, useEffect, useRef, useState } from "react";

export type SearchState<T> =
  | { status: "idle" }
  | { status: "pending"; query: string; slow: boolean }
  | { status: "success"; query: string; data: T }
  | { status: "error"; query: string };

export function useLatestSearch<T>(
  fetcher: (query: string, signal: AbortSignal) => Promise<T>,
  { slowAfterMs = 180 }: { slowAfterMs?: number } = {}
) {
  const [state, setState] = useState<SearchState<T>>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const slowTimer = useRef<number | undefined>(undefined);
  const pendingQuery = useRef<string | null>(null);
  const cache = useRef(new Map<string, T>());
  const mounted = useRef(true);
  // Keep the latest fetcher without making `search` depend on its identity.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    pendingQuery.current = null;
    window.clearTimeout(slowTimer.current);
  }, []);

  /** Abort any in-flight request and go back to idle (e.g. on input edit). */
  const reset = useCallback(() => {
    cancel();
    setState({ status: "idle" });
  }, [cancel]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);

  const search = useCallback(
    (query: string) => {
      if (cache.current.has(query)) {
        cancel();
        setState({ status: "success", query, data: cache.current.get(query)! });
        return;
      }
      if (pendingQuery.current === query) return; // that exact request is already running

      cancel();
      const controller = new AbortController();
      controllerRef.current = controller;
      pendingQuery.current = query;
      setState({ status: "pending", query, slow: false });
      slowTimer.current = window.setTimeout(() => {
        if (!controller.signal.aborted && mounted.current) {
          setState((s) => (s.status === "pending" && s.query === query ? { ...s, slow: true } : s));
        }
      }, slowAfterMs);

      fetcherRef.current(query, controller.signal).then(
        (data) => {
          if (controller.signal.aborted || !mounted.current) return;
          window.clearTimeout(slowTimer.current);
          pendingQuery.current = null;
          cache.current.set(query, data);
          setState({ status: "success", query, data });
        },
        () => {
          if (controller.signal.aborted || !mounted.current) return; // cancelled ≠ failed
          window.clearTimeout(slowTimer.current);
          pendingQuery.current = null;
          setState({ status: "error", query });
        }
      );
    },
    [cancel, slowAfterMs]
  );

  return { state, search, reset };
}

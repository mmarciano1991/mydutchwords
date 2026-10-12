/* useDictionarySearch — the autocomplete's request lifecycle.

   - nothing below 2 letters; a ~200 ms pause before asking
   - results cached per key (lib/dictionary/service): typing back over a
     prefix answers instantly
   - only the latest request can answer: an older, slower response never
     replaces a newer one (each request is aborted when the next starts)
   - `slow` only after a moment, so fast answers never flash a spinner
   - offline (or the server unreachable): the learner's own saved words
     are searched instead, and the screen says so
   - an error keeps the last results on screen, with "Try again"
   - every timer and request is cleaned up on unmount */
import { useCallback, useEffect, useRef, useState } from "react";
import { MIN_QUERY, search, type SearchResult } from "./dictionary/service";
import { searchKey, stripEdgePunctuation } from "./dictionary/normalize";
import type { SuggestRow } from "./dictionary/source";
import type { DictionaryEntry } from "./types";

const DEBOUNCE_MS = 200;
const SLOW_MS = 300;
export type SearchStatus = "idle" | "loading" | "results" | "empty" | "error" | "offline";

export interface DictionarySearch {
  status: SearchStatus;
  result: SearchResult | null;
  /** Offline: saved words matching the query. */
  offlineMatches: DictionaryEntry[];
  slow: boolean;
  limit: number;
  showMore: () => void;
  retry: () => void;
}

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** Offline search: deck words whose key starts with
 *  (or contains) the query. */
function searchSaved(query: string, saved: DictionaryEntry[]): DictionaryEntry[] {
  const key = searchKey(stripEdgePunctuation(query));
  const byKey = (e: DictionaryEntry) => searchKey(e.dutch);
  return [...saved.filter((e) => byKey(e).startsWith(key)), ...saved.filter((e) => !byKey(e).startsWith(key) && byKey(e).includes(key))].slice(0, 8);
}

export function useDictionarySearch(query: string, saved: DictionaryEntry[] = []): DictionarySearch {
  const [state, setState] = useState<{ status: SearchStatus; result: SearchResult | null; offlineMatches: DictionaryEntry[]; slow: boolean }>({
    status: "idle",
    result: null,
    offlineMatches: [],
    slow: false,
  });
  const [limit, setLimit] = useState(8);
  const [attempt, setAttempt] = useState(0);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const lastGood = useRef<SearchResult | null>(null);

  const key = searchKey(stripEdgePunctuation(query));

  // A new query starts with the default page size.
  useEffect(() => setLimit(8), [key]);

  useEffect(() => {
    if (key.length < MIN_QUERY) {
      setState({ status: "idle", result: null, offlineMatches: [], slow: false });
      return;
    }
    if (isOffline()) {
      setState({ status: "offline", result: null, offlineMatches: searchSaved(query, savedRef.current), slow: false });
      return;
    }
    const controller = new AbortController();
    let slowTimer: number | undefined;
    const timer = window.setTimeout(() => {
      // Keep what's on screen (no layout shift) while loading.
      setState((s) => ({ ...s, status: s.result ? s.status : "loading", slow: false }));
      slowTimer = window.setTimeout(() => setState((s) => ({ ...s, slow: true })), SLOW_MS);
      search(query, { limit, signal: controller.signal }).then(
        (result) => {
          if (controller.signal.aborted) return;
          window.clearTimeout(slowTimer);
          lastGood.current = result;
          const any = result.suggestions.length > 0 || result.didYouMean.length > 0 || Boolean(result.compound);
          setState({ status: any ? "results" : "empty", result, offlineMatches: [], slow: false });
        },
        () => {
          if (controller.signal.aborted) return; // cancelled ≠ failed
          window.clearTimeout(slowTimer);
          if (isOffline()) {
            setState({ status: "offline", result: null, offlineMatches: searchSaved(query, savedRef.current), slow: false });
          } else {
            // Cached results stay on screen under the error.
            setState({ status: "error", result: lastGood.current, offlineMatches: [], slow: false });
          }
        }
      );
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit, attempt]);

  const showMore = useCallback(() => setLimit((n) => n + 8), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, limit, showMore, retry };
}

export type { SuggestRow };

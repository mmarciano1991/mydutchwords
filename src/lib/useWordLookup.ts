/* useWordLookup — the full "what does this Dutch word resolve to" pipeline:
   an exact bundled/custom match, then deinflection (grammar before
   guesswork, possibly ambiguous between more than one real word), then a
   fuzzy suggestion list, then the online dictionary as a last resort.

   Extracted from Capture.tsx so Add from text (2a) can tap a word out of
   pasted text and run it through the exact same resolution — sense picker,
   deinflection, ambiguity and all — rather than a second, drifting copy of
   this logic. */
import { useEffect, useMemo } from "react";
import { deinflect, type Deinflection } from "./deinflect";
import { lookupLocal, suggestWords } from "./wordSources";
import { lookupWiktionary } from "./wiktionary";
import { useDebouncedValue } from "./useDebouncedValue";
import { useLatestSearch } from "./useLatestSearch";
import type { DictionaryEntry } from "./types";

/** No lookups (suggestions, deinflection, or online) below this many characters. */
const MIN_QUERY = 3;
/** Typing pause before suggestions and the online lookup kick in. Tapping a
 *  whole word out of pasted text settles just as fast — there's no keystroke
 *  to wait out, only this fixed pause. */
const DEBOUNCE_MS = 300;

function fetchOnline(query: string, signal: AbortSignal) {
  return lookupWiktionary(query, { signal });
}

export interface WordLookup {
  trimmed: string;
  missed: boolean;
  entry: DictionaryEntry | undefined;
  /** Every real inflection candidate found — empty (no deinflection lead),
   *  a single entry (resolved directly into `entry`), or more than one
   *  (ambiguous; `entry` stays undefined and the caller offers each as its
   *  own choice, the same shape as a sense picker). */
  deinflections: Deinflection[];
  deinflectionAmbiguous: boolean;
  suggestions: DictionaryEntry[];
  showSuggestions: boolean;
  searching: boolean;
  slow: boolean;
  notFound: boolean;
  failed: boolean;
  /** Re-runs a lookup that failed on a flaky connection. */
  retry: () => void;
  /** Aborts any in-flight request — call when the query changes. */
  reset: () => void;
}

export function useWordLookup(query: string): WordLookup {
  const trimmed = query.trim();
  const online = useLatestSearch(fetchOnline, { slowAfterMs: 180 });

  // Live local lookup — a Map get, cheap enough per keystroke or per tap.
  const localHit = useMemo(() => (trimmed ? lookupLocal(trimmed) : undefined), [trimmed]);

  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const settled = debounced === trimmed;
  const missed = settled && !localHit && trimmed.length >= MIN_QUERY;

  // Grammar before guesswork: a miss might just be an inflected form of a
  // word the dictionary already has. Checked first because when it hits —
  // even ambiguously — there's nothing left to suggest or search for.
  const deinflections = useMemo(
    () => (missed ? deinflect(trimmed, (term) => Boolean(lookupLocal(term))) : []),
    [missed, trimmed]
  );
  const deinflectionAmbiguous = deinflections.length > 1;
  const deinflectedEntry =
    deinflections.length === 1 ? lookupLocal(deinflections[0].lemma) : undefined;

  // Spelling suggestions are an edit-distance scan over the whole bundled
  // dictionary — too heavy per keystroke, so they compute only once settled.
  // Skipped once deinflection found real word(s): an edit-distance guess
  // next to a grammatical answer (certain or ambiguous) is noise, not a
  // second opinion.
  const suggestions = useMemo(
    () => (missed && deinflections.length === 0 ? suggestWords(trimmed) : []),
    [missed, deinflections, trimmed]
  );

  const { search, reset } = online;

  // Every miss goes online, near-matches or not — resting on the near-matches
  // alone assumed a miss was a typo, which held for "huurdrr" and failed for
  // every real word the bundled dictionary lacks: "termijn" was answered with
  // "terwijl" and never looked up. Deinflection is the one thing that DOES
  // stand in for it, ambiguous or not: once "sloten" has resolved to "slot"
  // and/or "sloot" locally, there's no missing word left to ask Wiktionary
  // about.
  const searchable = missed && deinflections.length === 0;

  useEffect(() => {
    if (searchable) search(trimmed);
  }, [searchable, trimmed, search]);

  // Online state is only trusted when it belongs to the current query.
  const onlineState = online.state;
  const current = "query" in onlineState && onlineState.query === trimmed ? onlineState : null;

  const entry =
    deinflectedEntry ??
    localHit ??
    (current?.status === "success" ? current.data ?? undefined : undefined);

  const searching = current?.status === "pending";
  const slow = current?.status === "pending" && current.slow;
  const notFound = !localHit && current?.status === "success" && current.data === null;
  const failed = current?.status === "error";
  const showSuggestions = !entry && suggestions.length > 0;

  return {
    trimmed,
    missed,
    entry,
    deinflections,
    deinflectionAmbiguous,
    suggestions,
    showSuggestions,
    searching,
    slow,
    notFound,
    failed,
    retry: () => missed && search(trimmed),
    reset,
  };
}

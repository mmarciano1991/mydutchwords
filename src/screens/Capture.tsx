/* Capture — "Add a word" (Figma 252:3612). The search lives in the appbar,
   and the body renders whichever state the flowchart lands on:

     1. Start           — nothing typed yet
     2. Suggestions     — no exact match, but close spellings to offer
     3a. Found          — the word, ready to add
     3b. Not found      — neither locally nor online
     3c. Already in deck — the existing row, so the user can see its progress

   Once typing pauses (DEBOUNCE_MS) a miss goes straight to the online
   dictionary — no extra tap. That request is abortable and latest-only
   (useLatestSearch): editing cancels it, the spinner shows only when the
   response is slow, and network failures get a retry instead of
   masquerading as "not found". */
import { useEffect, useMemo, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { lookupLocal, suggestWords } from "../lib/wordSources";
import { lookupWiktionary } from "../lib/wiktionary";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useLatestSearch } from "../lib/useLatestSearch";
import { Appbar } from "../components/Appbar";
import { GenderChip } from "../components/GenderChip";
import { MasteryBar } from "../components/MasteryBar";
import { Notice } from "../components/Notice";
import { WordCard } from "../components/WordCard";

/** No lookups (suggestions or online) below this many characters. */
const MIN_QUERY = 3;
/** Typing pause before suggestions and the online lookup kick in. */
const DEBOUNCE_MS = 300;

function fetchOnline(query: string, signal: AbortSignal) {
  return lookupWiktionary(query, { signal });
}

export function Capture({
  deckIds,
  levels,
  onSave,
  onBack,
}: {
  deckIds: Set<string>;
  /** Ladder level per deck word id — drives the mastery bar on state 3c. */
  levels: Map<string, number>;
  onSave: (entry: DictionaryEntry) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const online = useLatestSearch(fetchOnline, { slowAfterMs: 180 });

  const trimmed = query.trim();

  // Live local lookup while typing (a Map get — cheap enough per keystroke).
  const localHit = useMemo(() => (trimmed ? lookupLocal(trimmed) : undefined), [trimmed]);

  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const settled = debounced === trimmed;
  const missed = settled && !localHit && trimmed.length >= MIN_QUERY;

  // Spelling suggestions are an edit-distance scan over the whole bundled
  // dictionary — too heavy per keystroke, so they compute only once settled.
  const suggestions = useMemo(() => (missed ? suggestWords(trimmed) : []), [missed, trimmed]);

  const { search, reset } = online;

  // A miss with near-matches rests on those (state 2) — a typo is far more
  // likely than a word the bundled dictionary has never heard of, and it
  // costs no round-trip. Only a miss with nothing close goes online.
  const searchable = missed && suggestions.length === 0;

  useEffect(() => {
    if (searchable) search(trimmed);
  }, [searchable, trimmed, search]);

  function edit(value: string) {
    setQuery(value);
    reset(); // abort any in-flight lookup; the spinner disappears at once
  }

  // Online state is only trusted when it belongs to the current query.
  const onlineState = online.state;
  const current = "query" in onlineState && onlineState.query === trimmed ? onlineState : null;

  const entry =
    localHit ?? (current?.status === "success" ? current.data ?? undefined : undefined);
  const inDeck = entry ? deckIds.has(entry.id) : false;

  const searching = current?.status === "pending";
  const notFound = !localHit && current?.status === "success" && current.data === null;
  const failed = current?.status === "error";

  // State 2: close spellings to offer while nothing definite has resolved.
  const showSuggestions = !entry && !notFound && !failed && suggestions.length > 0;
  const hasBody = Boolean(entry || notFound || failed || showSuggestions || searching);

  return (
    <div className="screen">
      <Appbar
        title="Add a word"
        onBack={onBack}
        divider={hasBody}
        search={{
          value: query,
          onChange: edit,
          // Says what is searched (the dictionary's Dutch side), not "your
          // word" — which read as "search the words you already have".
          placeholder: "Search a Dutch word",
          autoFocus: true,
          // Escape hatch out of state 2: look it up online anyway.
          onSubmit: () => missed && search(trimmed),
        }}
      />

      <div className="screen__body gutter" style={{ paddingTop: 16, paddingBottom: 16 }}>
        {/* ── 1. Start ── the screen is otherwise blank before anything is
            typed, which left "add a word" meaning whatever the user assumed.
            One line, naming both halves: where the word comes from, and
            where it goes. */}
        {!hasBody && (
          <p
            className="muted"
            style={{ fontSize: 15, lineHeight: 1.55, margin: 0, padding: "24px 6px", textAlign: "center" }}
          >
            Look up a Dutch word in the dictionary, then add it to your deck.
          </p>
        )}

        {/* ── 2. Suggestions ── */}
        {showSuggestions && (
          <div className="addword__block">
            <div className="eyebrow">Did you mean</div>
            <div className="suggestion-row">
              {suggestions.map((s) => (
                <button key={s.id} className="btn btn--secondary" onClick={() => edit(s.dutch)}>
                  {s.dutch}
                </button>
              ))}
            </div>
            <button className="link-btn" onClick={() => search(trimmed)}>
              No — look up &ldquo;{trimmed}&rdquo; online
            </button>
          </div>
        )}

        {/* Spinner only for genuinely slow responses (>180ms) — fast ones
            resolve before it ever appears, so there's no flash. */}
        {searching && current.slow && (
          <p className="muted" role="status" style={{ fontSize: 14, margin: "4px 2px" }}>
            Searching the online dictionary…
          </p>
        )}

        {/* ── 3a. Found ── */}
        {entry && !inDeck && (
          <div className="addword__block">
            <WordCard entry={entry} />
            <button className="btn btn--primary" onClick={() => onSave(entry)}>
              Add to deck
            </button>
          </div>
        )}

        {/* ── 3c. Already in deck ── */}
        {entry && inDeck && (
          <div className="addword__block">
            <div className="wordrow">
              <div className="wordrow__row">
                <div className="wordrow__main">
                  <div className="wordrow__content">
                    <span className="wordrow__head">
                      <GenderChip gender={entry.gender} size="sm" />
                      <span className="wordrow__dutch">{entry.dutch}</span>
                    </span>
                    <span className="wordrow__gloss">{entry.english}</span>
                  </div>
                </div>
                <MasteryBar level={levels.get(entry.id) ?? 0} withLabel />
              </div>
            </div>
            <Notice type="info">You already have this word in your deck</Notice>
          </div>
        )}

        {/* ── 3b. Not found ── */}
        {notFound && (
          <div className="addword__block">
            <Notice type="caution">We couldn&rsquo;t find &ldquo;{trimmed}&rdquo;</Notice>
            {suggestions.length > 0 && (
              <>
                <div className="eyebrow">Did you mean</div>
                <div className="suggestion-chips">
                  {suggestions.map((s) => (
                    <button key={s.id} className="suggestion-chip" onClick={() => edit(s.dutch)}>
                      {s.dutch}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {failed && (
          <div className="addword__block">
            <Notice type="error">
              The online dictionary didn&rsquo;t respond. Check your connection and try again.
            </Notice>
            <button className="btn btn--secondary" onClick={() => search(trimmed)}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

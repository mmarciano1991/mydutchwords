/* Capture — "Add a word" flow (product flowchart + Figma 130:232).
   Type a Dutch word → instant lookup in the bundled dictionary. If it isn't
   there, after a 300ms typing pause a notice offers the online lookup as a
   button and spelling suggestions appear for close misses. The online
   request is abortable and latest-only (useLatestSearch): editing the query
   cancels it, a spinner shows only when the response is slow, "not found"
   renders only after a completed empty response, and network failures get
   their own retry state instead of masquerading as "not found".
   A found word shows the two treatment choices: save to study, or mark as
   already known (skips the ramp, straight to Mature). Figma 161:334. */
import { useMemo, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { lookupLocal, suggestWords } from "../lib/wordSources";
import { lookupWiktionary } from "../lib/wiktionary";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useLatestSearch } from "../lib/useLatestSearch";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { Notice } from "../components/Notice";
import { SearchIcon } from "../components/icons";
import { Check } from "../icons";

/** No lookups (suggestions or online) below this many characters. */
const MIN_QUERY = 3;
/** Typing pause before suggestions/notice appear. */
const DEBOUNCE_MS = 300;

function fetchOnline(query: string, signal: AbortSignal) {
  return lookupWiktionary(query, { signal });
}

export function Capture({
  deckIds,
  onSave,
  onBack,
}: {
  deckIds: Set<string>;
  /** Adds the word to the deck; `known` skips the ramp (straight to Mature). */
  onSave: (entry: DictionaryEntry, known: boolean) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const online = useLatestSearch(fetchOnline, { slowAfterMs: 180 });

  const trimmed = query.trim();

  // Live local lookup while typing (a Map get — cheap enough per keystroke).
  const localHit = useMemo(() => (trimmed ? lookupLocal(trimmed) : undefined), [trimmed]);

  // The debounce gate: suggestions, the "not in your dictionary" notice and
  // the online CTA appear only once typing has paused for DEBOUNCE_MS.
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const settled = debounced === trimmed;

  // Spelling suggestions are an edit-distance scan over the whole bundled
  // dictionary — too heavy per keystroke, so they compute only once settled.
  const suggestions = useMemo(
    () => (settled && !localHit && trimmed.length >= MIN_QUERY ? suggestWords(trimmed) : []),
    [settled, localHit, trimmed]
  );

  function edit(value: string) {
    setQuery(value);
    online.reset(); // abort any in-flight lookup; spinner disappears at once
  }

  function searchOnline() {
    if (localHit || trimmed.length < MIN_QUERY) return;
    online.search(trimmed);
  }

  // Online state is only trusted when it belongs to the current query.
  const onlineState = online.state;
  const current = "query" in onlineState && onlineState.query === trimmed ? onlineState : null;

  const foundEntry =
    localHit ?? (current?.status === "success" ? current.data ?? undefined : undefined);
  const found = foundEntry
    ? { entry: foundEntry, duplicate: deckIds.has(foundEntry.id) }
    : null;

  const searching = current?.status === "pending";
  const notFoundOnline = !localHit && current?.status === "success" && current.data === null;
  const failed = current?.status === "error";

  // The idle prompt (notice + CTA + suggestions) waits for the debounce to
  // settle and hides while a request is pending or resolved — no flicker.
  const showPrompt = settled && !localHit && trimmed.length >= MIN_QUERY && !current;

  const suggestionChips = (list: DictionaryEntry[]) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
      {list.map((s) => (
        <button key={s.id} className="suggestion-chip" onClick={() => edit(s.dutch)}>
          {s.dutch}
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <IconButton action="close" onClick={onBack} aria-label="Back" />
        <span className="title-serif" style={{ fontSize: 21 }}>Add a word</span>
      </div>

      <div className="screen__body gutter" style={{ paddingTop: 4, paddingBottom: 16 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            searchOnline();
          }}
        >
          <label className="field">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => edit(e.target.value)}
              placeholder="Type a Dutch word…"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{ fontFamily: "var(--font-sans)", fontSize: 16 }}
            />
          </label>
        </form>

        {found && found.duplicate && (
          <div style={{ marginTop: 16 }}>
            <Notice type="error">You already have this word in Woordkast.</Notice>
          </div>
        )}

        {found && (
          <div className="capture-card" style={found.duplicate ? { opacity: 0.62 } : undefined}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <GenderChip gender={found.entry.gender} />
              <span className="eyebrow">{found.entry.gender ? "noun" : "word"}</span>
            </div>
            <div className="capture-card__word">{found.entry.dutch}</div>
            <div className="capture-card__gloss">{found.entry.english}</div>
            {found.entry.example && (
              <>
                <div className="capture-card__rule" />
                <div className="eyebrow">In context</div>
                <div className="quote">{found.entry.example}</div>
                <div className="capture-card__example-en">{found.entry.exampleEn}</div>
              </>
            )}
          </div>
        )}

        {found && !found.duplicate && (
          <>
            <div className="eyebrow" style={{ margin: "16px 2px 0" }}>How should we treat it?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 11 }}>
              <button className="capture-option capture-option--primary" onClick={() => onSave(found.entry, false)}>
                <span className="capture-option__icon capture-option__icon--primary">
                  <svg width="20" height="16" viewBox="0 0 22 18" fill="none">
                    <path d="M3 5.5A2.5 2.5 0 015.5 3H16l3 3v7A2.5 2.5 0 0116.5 15.5h-11A2.5 2.5 0 013 13V5.5z" stroke="#fff" strokeWidth="1.6" />
                  </svg>
                </span>
                <span className="capture-option__text">
                  <span className="capture-option__title">Save to study</span>
                  <span className="capture-option__sub">Starts in New, ramps up with practice</span>
                </span>
              </button>

              <button className="capture-option capture-option--known" onClick={() => onSave(found.entry, true)}>
                <span className="capture-option__icon capture-option__icon--known">
                  <Check size={20} />
                </span>
                <span className="capture-option__text">
                  <span className="capture-option__title capture-option__title--known">I already know it</span>
                  <span className="capture-option__sub">Goes straight to Mature · resurfaces rarely</span>
                </span>
              </button>
            </div>
          </>
        )}

        {showPrompt && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Notice type="caution">
              &ldquo;{trimmed}&rdquo; isn&rsquo;t in your local dictionary yet.
            </Notice>
            <button className="btn btn--primary" onClick={searchOnline}>
              Add to your dictionary
            </button>
            {suggestions.length > 0 && (
              <>
                <div className="eyebrow" style={{ margin: "4px 2px 0" }}>Did you mean</div>
                {suggestionChips(suggestions)}
              </>
            )}
          </div>
        )}

        {/* Spinner only for genuinely slow responses (>180ms) — fast ones
            resolve before it ever appears, so there's no flash. */}
        {searching && current.slow && (
          <p className="muted" role="status" style={{ fontSize: 14, margin: "16px 2px 0" }}>
            Searching the online dictionary…
          </p>
        )}

        {notFoundOnline && (
          <div style={{ marginTop: 16 }}>
            <Notice type="caution">
              We couldn&rsquo;t find &ldquo;{trimmed}&rdquo; online either. Check the spelling
              {suggestions.length > 0 ? " — or did you mean:" : "."}
            </Notice>
            {suggestions.length > 0 && suggestionChips(suggestions)}
          </div>
        )}

        {failed && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Notice type="error">
              The online dictionary didn&rsquo;t respond. Check your connection and try again.
            </Notice>
            <button className="btn btn--secondary" onClick={() => online.search(trimmed)}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

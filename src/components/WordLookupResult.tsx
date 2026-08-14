/* WordLookupResult — renders whatever a useWordLookup pipeline resolved to:
   a spelling-suggestion row, an ambiguous-deinflection picker, a single
   deinflection's explanation, a found word (one sense or several), "already
   in deck", or a not-found/failed state.

   Shared by Capture (typed into a search field) and Add from text (tapped
   out of pasted reading) — they differ only in how the query is chosen and
   where a save's result goes, not in what a resolved word looks like. */
import type { DictionaryEntry } from "../lib/types";
import type { WordLookup } from "../lib/useWordLookup";
import { entryForSense, lookupLocal } from "../lib/wordSources";
import { DeinflectionCard } from "./DeinflectionCard";
import { GenderChip } from "./GenderChip";
import { MasteryBar } from "./MasteryBar";
import { Notice } from "./Notice";
import { SenseCard } from "./SenseCard";
import { WordCard } from "./WordCard";

export function WordLookupResult({
  lookup,
  deckIds,
  levels,
  onSave,
  onEditSuggestion,
}: {
  lookup: WordLookup;
  deckIds: Set<string>;
  levels: Map<string, number>;
  onSave: (entry: DictionaryEntry) => void;
  /** Replaces the query with a tapped suggestion — only meaningful when the
   *  caller has an editable query to replace (Capture's search field). Omit
   *  to hide the suggestion row entirely: Add from text has no field to put
   *  a correction into, only the word as it was actually printed. */
  onEditSuggestion?: (dutch: string) => void;
}) {
  const {
    trimmed,
    entry,
    deinflections,
    deinflectionAmbiguous,
    suggestions,
    showSuggestions,
    searching,
    slow,
    notFound,
    failed,
    retry,
  } = lookup;
  const inDeck = entry ? deckIds.has(entry.id) : false;

  return (
    <>
      {/* ── Suggestions ── near-matches, offered next to the online result
          rather than in place of it. */}
      {onEditSuggestion && showSuggestions && (
        <div className="addword__block">
          <div className="eyebrow">Did you mean</div>
          <div className="suggestion-row">
            {suggestions.map((s) => (
              <button key={s.id} className="btn btn--secondary" onClick={() => onEditSuggestion(s.dutch)}>
                {s.dutch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spinner only for genuinely slow responses (>180ms) — fast ones
          resolve before it ever appears, so there's no flash. */}
      {searching && slow && (
        <p className="muted" role="status" style={{ fontSize: 14, margin: "4px 2px" }}>
          Searching the online dictionary…
        </p>
      )}

      {/* ── Ambiguous deinflection ── Dutch can inflect two unrelated words
          identically — "sloten" is both "locks" and "ditches" — so more than
          one real candidate means there isn't a single right answer to
          assert. Same shape as the sense picker below: every candidate its
          own card, its own Add button, nothing pre-selected. */}
      {deinflectionAmbiguous && (
        <div className="addword__block">
          <div className="eyebrow">Which word did you mean?</div>
          <div className="sense-list">
            {deinflections.map((d) => {
              const candidate = lookupLocal(d.lemma);
              if (!candidate) return null;
              return (
                <DeinflectionCard
                  key={d.lemma}
                  entry={candidate}
                  reason={d.reason}
                  onAdd={() => onSave(candidate)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Deinflected (single candidate) ── explains why a word that
          wasn't typed exactly is what's being shown. */}
      {deinflections.length === 1 && entry && (
        <div className="addword__block">
          <Notice type="info">
            &ldquo;{trimmed}&rdquo; → <strong>{deinflections[0].lemma}</strong> ({deinflections[0].reason})
          </Notice>
        </div>
      )}

      {/* ── Found, multiple senses ── every meaning gets its own card and
          Add button, instead of picking one silently. */}
      {entry && !inDeck && (entry.senses?.length ?? 0) > 1 && (
        <div className="addword__block">
          <div className="eyebrow">Which meaning fits?</div>
          <div className="sense-list">
            {entry.senses!.map((sense, i) => (
              <SenseCard
                key={i}
                dutch={entry.dutch}
                sense={sense}
                onAdd={() => onSave(entryForSense(entry, sense))}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Found, one sense ── */}
      {entry && !inDeck && (entry.senses?.length ?? 0) <= 1 && (
        <div className="addword__block">
          <WordCard entry={entry} />
          <button className="btn btn--primary" onClick={() => onSave(entry)}>
            Add to deck
          </button>
        </div>
      )}

      {/* ── Already in deck ── */}
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

      {/* ── Not found ── the near-matches are rendered once, above, for
          every state that still has them. */}
      {notFound && (
        <div className="addword__block">
          <Notice type="caution">We couldn&rsquo;t find &ldquo;{trimmed}&rdquo;</Notice>
        </div>
      )}

      {failed && (
        <div className="addword__block">
          <Notice type="error">
            The online dictionary didn&rsquo;t respond. Check your connection and try again.
          </Notice>
          <button className="btn btn--secondary" onClick={retry}>
            Try again
          </button>
        </div>
      )}
    </>
  );
}

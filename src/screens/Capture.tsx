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
import { useEffect, useMemo, useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { deinflect } from "../lib/deinflect";
import { entryForSense, lookupLocal, suggestWords } from "../lib/wordSources";
import { lookupWiktionary } from "../lib/wiktionary";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useLatestSearch } from "../lib/useLatestSearch";
import { Appbar } from "../components/Appbar";
import { GenderChip } from "../components/GenderChip";
import { MasteryBar } from "../components/MasteryBar";
import { Notice } from "../components/Notice";
import { SenseCard } from "../components/SenseCard";
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
  onUndo,
  onViewDeck,
  onBack,
}: {
  deckIds: Set<string>;
  /** Ladder level per deck word id — drives the mastery bar on state 3c. */
  levels: Map<string, number>;
  onSave: (entry: DictionaryEntry) => void;
  /** Takes the last-added word back out of the deck. */
  onUndo: (entryId: string) => void;
  onViewDeck: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  // The word just added, so the screen can confirm it without navigating
  // away, and the count of words added since this screen opened.
  const [added, setAdded] = useState<DictionaryEntry | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useLatestSearch(fetchOnline, { slowAfterMs: 180 });

  const trimmed = query.trim();

  // Live local lookup while typing (a Map get — cheap enough per keystroke).
  const localHit = useMemo(() => (trimmed ? lookupLocal(trimmed) : undefined), [trimmed]);

  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const settled = debounced === trimmed;
  const missed = settled && !localHit && trimmed.length >= MIN_QUERY;

  // Grammar before guesswork: a miss might just be an inflected form of a
  // word the dictionary already has ("huurders" of "huurder"), which is a
  // real answer, not a "did you mean". Checked first because when it hits,
  // there's nothing left to suggest or search for.
  const deinflection = useMemo(
    () => (missed ? deinflect(trimmed, (term) => Boolean(lookupLocal(term))) : null),
    [missed, trimmed]
  );
  const deinflectedEntry = deinflection ? lookupLocal(deinflection.lemma) : undefined;

  // Spelling suggestions are an edit-distance scan over the whole bundled
  // dictionary — too heavy per keystroke, so they compute only once settled.
  // Skipped once deinflection already found the real word: an edit-distance
  // guess next to a grammatical certainty is noise, not a second opinion.
  const suggestions = useMemo(
    () => (missed && !deinflection ? suggestWords(trimmed) : []),
    [missed, deinflection, trimmed]
  );

  const { search, reset } = online;

  // Every miss goes online, near-matches or not — resting on the near-matches
  // alone assumed a miss was a typo, which held for "huurdrr" and failed for
  // every real word the bundled dictionary lacks: "termijn" was answered with
  // "terwijl" and never looked up. Deinflection is the one thing that DOES
  // stand in for it: once "huurders" has resolved to "huurder" locally,
  // there's no missing word left to ask Wiktionary about.
  const searchable = missed && !deinflection;

  useEffect(() => {
    if (searchable) search(trimmed);
  }, [searchable, trimmed, search]);

  function edit(value: string) {
    setQuery(value);
    setAdded(null); // typing again means we're past the last confirmation
    reset(); // abort any in-flight lookup; the spinner disappears at once
  }

  /** Adds the word and stays put, ready for the next one. */
  function save(entry: DictionaryEntry) {
    onSave(entry);
    setAdded(entry);
    setAddedCount((n) => n + 1);
    setQuery("");
    reset();
    inputRef.current?.focus();
  }

  function undo() {
    if (!added) return;
    onUndo(added.id);
    setAdded(null);
    setAddedCount((n) => Math.max(0, n - 1));
    inputRef.current?.focus();
  }

  // Online state is only trusted when it belongs to the current query.
  const onlineState = online.state;
  const current = "query" in onlineState && onlineState.query === trimmed ? onlineState : null;

  const entry =
    deinflectedEntry ??
    localHit ??
    (current?.status === "success" ? current.data ?? undefined : undefined);
  const inDeck = entry ? deckIds.has(entry.id) : false;

  const searching = current?.status === "pending";
  const notFound = !localHit && current?.status === "success" && current.data === null;
  const failed = current?.status === "error";

  // Close spellings, offered alongside whatever the online lookup returns
  // rather than instead of it. They stay up through a "not found" or a
  // failed request, since that's exactly when they're the only lead left.
  const showSuggestions = !entry && suggestions.length > 0;
  const hasBody = Boolean(entry || notFound || failed || showSuggestions || searching || added);

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
          inputRef,
          // Re-runs a lookup that failed on a flaky connection.
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

        {/* ── Just added ── the confirmation that replaces navigating to the
            deck, so a second word costs two taps instead of four. */}
        {added && (
          <div className="addword__block">
            <Notice type="success">
              <strong>{added.dutch}</strong> added to your deck
              {addedCount > 1 ? ` · ${addedCount} words this visit` : ""}
            </Notice>
            <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 2 }}>
              <button className="link-btn" onClick={undo}>
                Undo
              </button>
              <button className="link-btn" onClick={onViewDeck}>
                View your deck
              </button>
            </div>
          </div>
        )}

        {/* ── 2. Suggestions ── near-matches, offered next to the online
            result rather than in place of it. */}
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
          </div>
        )}

        {/* Spinner only for genuinely slow responses (>180ms) — fast ones
            resolve before it ever appears, so there's no flash. */}
        {searching && current.slow && (
          <p className="muted" role="status" style={{ fontSize: 14, margin: "4px 2px" }}>
            Searching the online dictionary…
          </p>
        )}

        {/* ── Deinflected ── says why a word that wasn't typed exactly is
            what's being shown, so the match reads as an explanation rather
            than a correction the user didn't ask for. Shown whether or not
            it's already in the deck (3a or 3c below). */}
        {deinflection && entry && (
          <div className="addword__block">
            <Notice type="info">
              &ldquo;{trimmed}&rdquo; → <strong>{deinflection.lemma}</strong> ({deinflection.reason})
            </Notice>
          </div>
        )}

        {/* ── 3a. Found ── a word with more than one known meaning shows all
            of them, each with its own Add button, instead of picking one
            silently. That silent pick is exactly what run 04 of the study
            caught: "aanslag" resolved to "attack" on a tax letter, with no
            sign a second, correct meaning existed. */}
        {entry && !inDeck && (entry.senses?.length ?? 0) > 1 && (
          <div className="addword__block">
            <div className="eyebrow">Which meaning fits?</div>
            <div className="sense-list">
              {entry.senses!.map((sense, i) => (
                <SenseCard
                  key={i}
                  dutch={entry.dutch}
                  sense={sense}
                  onAdd={() => save(entryForSense(entry, sense))}
                />
              ))}
            </div>
          </div>
        )}

        {entry && !inDeck && (entry.senses?.length ?? 0) <= 1 && (
          <div className="addword__block">
            <WordCard entry={entry} />
            <button className="btn btn--primary" onClick={() => save(entry)}>
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

        {/* ── 3b. Not found ── the near-matches are rendered once, above,
            for every state that still has them. */}
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
            <button className="btn btn--secondary" onClick={() => search(trimmed)}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Capture — "Add a word" (Figma 252:3612). The search lives in the appbar,
   and the body renders whichever state the flowchart lands on:

     1. Start           — nothing typed yet
     2. Suggestions     — no exact match, but close spellings to offer
     3a. Found          — the word, ready to add
     3b. Not found      — neither locally nor online
     3c. Already in deck — the existing row, so the user can see its progress

   The lookup pipeline lives in useWordLookup and the result rendering in
   WordLookupResult — both shared with Add from text, which taps a word out
   of pasted reading instead of typing one. */
import { useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { useWordLookup } from "../lib/useWordLookup";
import { Appbar } from "../components/Appbar";
import { Notice } from "../components/Notice";
import { WordLookupResult } from "../components/WordLookupResult";

export function Capture({
  deckIds,
  levels,
  onSave,
  onUndo,
  onViewDeck,
  onAddFromText,
  onBack,
}: {
  deckIds: Set<string>;
  /** Ladder level per deck word id — drives the mastery bar on state 3c. */
  levels: Map<string, number>;
  onSave: (entry: DictionaryEntry) => void;
  /** Takes the last-added word back out of the deck. */
  onUndo: (entryId: string) => void;
  onViewDeck: () => void;
  /** Opens "Add from text" (2a) — offered only on the blank start state, the
   *  same place the screen already explains what typing here does. */
  onAddFromText: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  // The word just added, so the screen can confirm it without navigating
  // away, and the count of words added since this screen opened.
  const [added, setAdded] = useState<DictionaryEntry | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const lookup = useWordLookup(query);
  const { entry, deinflectionAmbiguous, notFound, failed, showSuggestions, searching, retry, reset } = lookup;

  function edit(value: string) {
    setQuery(value);
    setAdded(null); // typing again means we're past the last confirmation
    reset(); // abort any in-flight lookup; the spinner disappears at once
  }

  /** Adds the word and stays put, ready for the next one. */
  function save(entryToSave: DictionaryEntry) {
    onSave(entryToSave);
    setAdded(entryToSave);
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

  const hasBody = Boolean(
    entry || deinflectionAmbiguous || notFound || failed || showSuggestions || searching || added
  );

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
          onSubmit: retry,
        }}
      />

      <div className="screen__body gutter" style={{ paddingTop: 16, paddingBottom: 16 }}>
        {/* ── 1. Start ── the screen is otherwise blank before anything is
            typed, which left "add a word" meaning whatever the user assumed.
            One line, naming both halves: where the word comes from, and
            where it goes — plus the door into capturing several words at
            once from something you're already reading. */}
        {!hasBody && (
          <div style={{ padding: "24px 6px", textAlign: "center" }}>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>
              Look up a Dutch word in the dictionary, then add it to your deck.
            </p>
            <button className="link-btn" style={{ marginTop: 14 }} onClick={onAddFromText}>
              Or add several words from something you're reading →
            </button>
          </div>
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

        <WordLookupResult lookup={lookup} deckIds={deckIds} levels={levels} onSave={save} onEditSuggestion={edit} />
      </div>
    </div>
  );
}

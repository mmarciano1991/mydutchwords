/* Capture — "Add a word" (Figma 252:3612, states A–D 194:484 · 445:4464 ·
   445:4649 · 445:4706).

   The search field suggests as the learner types (components/WordSearch);
   picking a suggestion shows every sense of the word as result cards
   (components/SenseResults), where each one is added on its own. The
   screen stays put after an add, ready for the next word. */
import { useMemo, useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { deckMembership } from "../lib/deckMembership";
import { useLookup } from "../lib/useLookup";
import { Appbar } from "../components/Appbar";
import { Notice } from "../components/Notice";
import { SenseResults } from "../components/SenseResults";
import { WordSearch } from "../components/WordSearch";

export function Capture({
  deckEntries,
  onSave,
  onSavePersonal,
  onBack,
}: {
  /** The deck, resolved — for "In your deck" and offline search. */
  deckEntries: DictionaryEntry[];
  /** Adds senses to the deck. */
  onSave: (entries: DictionaryEntry[]) => void;
  /** Saves a word the dictionary doesn't have, with the learner's own
   *  translation. */
  onSavePersonal: (form: string, translation: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [added, setAdded] = useState<DictionaryEntry[] | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const membership = useMemo(() => deckMembership(deckEntries), [deckEntries]);
  const lookup = useLookup(picked);

  function edit(value: string) {
    setQuery(value);
    setAdded(null);
    if (!value.trim()) setPicked(null);
  }

  function pick(form: string) {
    setPicked(form);
    setQuery(form);
  }

  function save(entries: DictionaryEntry[]) {
    const fresh = entries.filter((e) => !membership.has({ senseId: e.id, form: e.dutch, gloss: e.english }));
    if (!fresh.length) return;
    onSave(fresh);
    setAdded(fresh);
    setAddedCount((n) => n + fresh.length);
  }

  const hasBody = Boolean(picked || added);

  return (
    <div className="screen">
      <Appbar
        title="Add a word"
        onBack={onBack}
        divider={hasBody}
        searchSlot={
          <WordSearch
            value={query}
            onChange={edit}
            onPick={(p) => pick(p.form)}
            inDeckWordIds={membership.wordIds}
            saved={deckEntries}
            autoFocus
            inputRef={inputRef}
          />
        }
      />

      <div className="screen__body gutter capture-body">
        {!hasBody && !query && (
          <div className="capture-empty">
            <p className="muted add-lede">Look up a Dutch word in the dictionary, then add it to your deck.</p>
          </div>
        )}

        {added && (
          <div className="addword__block">
            <Notice type="success">
              {added.length === 1 ? (
                <>
                  <strong lang="nl">{added[0].dutch}</strong> added to your deck
                </>
              ) : (
                <>{added.length} words added to your deck</>
              )}
              {addedCount > added.length ? ` · ${addedCount} this visit` : ""}
            </Notice>
          </div>
        )}

        {picked && lookup.status === "loading" && (
          <div className="result-card result-card--loading" role="status" aria-label="Looking up the word">
            <div className="skeleton skeleton--chip" />
            <div className="skeleton skeleton--word" />
          </div>
        )}
        {picked && lookup.status === "error" && (
          <div className="addword__block">
            <Notice type="error">The dictionary didn&rsquo;t respond. Check your connection and try again.</Notice>
            <button className="btn btn--secondary" onClick={lookup.retry}>
              Try again
            </button>
          </div>
        )}
        {picked && lookup.status === "done" && (
          <SenseResults
            result={lookup.result}
            isInDeck={(i) => membership.has(i.snapshot)}
            onSave={save}
            onPickSuggestion={(form) => pick(form)}
            onSavePersonal={(form, translation) => {
              onSavePersonal(form, translation);
              setAddedCount((n) => n + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* Deck — the senses the learner has added, as dictionary cards (Figma
   dictionary_card 104:161). The search filters the deck; with no deck
   match it falls through to the dictionary, so a word not yet in the deck
   can be added from here too.

   ⋮ on a card: Edit opens the edit form for that sense (same id, same
   progress); Delete removes that sense only — never the word's other
   senses — with Undo, the app's way of confirming a removal. A deleted
   sense is addable again in search straight away. */
import { useMemo, useState } from "react";
import type { DeckItem, DictionaryEntry } from "../lib/types";
import type { Word } from "../lib/learningEngine";
import { deckMembership } from "../lib/deckMembership";
import { searchKey } from "../lib/dictionary/normalize";
import { contextSentence } from "../lib/sentenceTarget";
import { useLookup } from "../lib/useLookup";
import { Appbar } from "../components/Appbar";
import { DictionaryCard } from "../components/DictionaryCard";
import { InfoPill } from "../components/InfoPill";
import { masteryOf } from "../components/MasteryStatus";
import { Notice } from "../components/Notice";
import { SenseResults } from "../components/SenseResults";
import { ContextSentence } from "../components/exercises/ContextSentence";

type Edit = { english: string; example: string; exampleEn: string };

export function Browse({
  entries,
  words,
  tricky,
  onRemove,
  onRestore,
  onEdit,
  onSave,
  onSavePersonal,
}: {
  /** The deck, resolved (newest first). */
  entries: DictionaryEntry[];
  /** Learning state per deck id. */
  words: Map<string, Word>;
  tricky: Set<string>;
  onRemove: (entryId: string) => DeckItem | undefined;
  onRestore: (item: DeckItem) => void;
  onEdit: (entryId: string, edit: Edit) => void;
  onSave: (entries: DictionaryEntry[]) => void;
  onSavePersonal: (form: string, translation: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Edit>({ english: "", example: "", exampleEn: "" });
  const [removed, setRemoved] = useState<{ item: DeckItem; dutch: string } | null>(null);
  const membership = useMemo(() => deckMembership(entries), [entries]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    const k = searchKey(q);
    return entries.filter((e) => searchKey(e.dutch).includes(k) || e.english.toLowerCase().includes(q));
  }, [query, entries]);

  const noDeckMatch = query.trim().length >= 2 && results.length === 0;
  const lookup = useLookup(noDeckMatch ? query.trim() : null);

  function remove(e: DictionaryEntry) {
    const item = onRemove(e.id);
    if (item) setRemoved({ item, dutch: e.dutch });
    if (openId === e.id) setOpenId(null);
    if (editingId === e.id) setEditingId(null);
  }

  function startEdit(e: DictionaryEntry) {
    setOpenId(e.id);
    setEditingId(e.id);
    setDraft({ english: e.english, example: e.example, exampleEn: e.exampleEn });
  }

  function saveEdit(id: string) {
    onEdit(id, { ...draft, english: draft.english.trim() });
    setEditingId(null);
  }

  return (
    <div className="screen">
      <Appbar
        title="Your deck"
        floating
        search={
          entries.length > 0
            ? { value: query, onChange: setQuery, placeholder: "Search Dutch or English…", ariaLabel: "Search your deck by Dutch or English word" }
            : undefined
        }
      />

      <div className="screen__body gutter browse-body">
        {removed && (
          <div className="browse-removed">
            <Notice type="info">
              <strong lang="nl">{removed.dutch}</strong> removed from your deck
            </Notice>
            <button
              className="link-btn"
              onClick={() => {
                onRestore(removed.item);
                setRemoved(null);
              }}
            >
              Undo
            </button>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="muted browse-empty">Your deck is empty. Tap + to look up a word and add it here.</p>
        ) : noDeckMatch ? (
          <div>
            <p className="muted browse-count">No deck words match “{query}” — here’s what the dictionary has:</p>
            {lookup.status === "done" && (
              <SenseResults
                result={lookup.result}
                isInDeck={(i) => membership.has(i.snapshot)}
                onSave={onSave}
                onPickSuggestion={setQuery}
                onSavePersonal={onSavePersonal}
              />
            )}
            {lookup.status === "error" && <Notice type="error">The dictionary didn&rsquo;t respond. Check your connection and try again.</Notice>}
          </div>
        ) : results.length === 0 ? (
          <p className="muted browse-empty">No deck words match “{query}”.</p>
        ) : (
          <ul className="dict-list">
            {results.map((e) => {
              const word = words.get(e.id);
              const editing = editingId === e.id;
              return (
                <li key={e.id}>
                  <DictionaryCard
                    entry={e}
                    mastery={word ? masteryOf(word) : "New"}
                    tricky={tricky.has(e.id)}
                    open={openId === e.id}
                    onToggle={() => {
                      setOpenId((prev) => (prev === e.id ? null : e.id));
                      setEditingId(null);
                    }}
                    onEdit={() => startEdit(e)}
                    onDelete={() => remove(e)}
                  >
                    {editing ? (
                      <form
                        className="wordrow__edit"
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          if (draft.english.trim()) saveEdit(e.id);
                        }}
                      >
                        <label className="auth-field">
                          <span className="auth-field__label">Translation</span>
                          <input className="text-input" lang="en" value={draft.english} onChange={(ev) => setDraft({ ...draft, english: ev.target.value })} autoFocus />
                        </label>
                        <label className="auth-field">
                          <span className="auth-field__label">Example (Dutch)</span>
                          <input className="text-input" lang="nl" value={draft.example} onChange={(ev) => setDraft({ ...draft, example: ev.target.value })} />
                        </label>
                        <label className="auth-field">
                          <span className="auth-field__label">Example (English)</span>
                          <input className="text-input" lang="en" value={draft.exampleEn} onChange={(ev) => setDraft({ ...draft, exampleEn: ev.target.value })} />
                        </label>
                        <div className="wordrow__edit-actions">
                          <button type="button" className="btn btn--secondary wordrow__edit-btn" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                          <button type="submit" className="btn btn--primary wordrow__edit-btn" disabled={!draft.english.trim()}>
                            Save
                          </button>
                        </div>
                      </form>
                    ) : (
                      <InContext entry={e} />
                    )}
                  </DictionaryCard>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The word in its sentence — the captured one first — or, with none, a
 *  declared gap. Never another sense's example. */
function InContext({ entry }: { entry: DictionaryEntry }) {
  const ctx = contextSentence(entry);
  if (!ctx) {
    return <p className="faint wordrow__no-example">Example coming soon</p>;
  }
  return (
    <>
      <ContextSentence entry={entry} context={ctx} />
      {ctx.generated && <InfoPill kind="generated" />}
      {ctx.source === "captured" && !entry.snapshot?.examples.some((x) => x.source !== "captured") && (
        <p className="faint wordrow__no-example">A dictionary example is coming soon — this is the sentence you saved it from.</p>
      )}
    </>
  );
}

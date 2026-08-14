import { useMemo, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { Appbar } from "../components/Appbar";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { MasteryBar } from "../components/MasteryBar";

/** Just the fields a user can correct — gender and the id stay as they are. */
type Edit = { english: string; example: string; exampleEn: string };

/* Deck screen — the words the user has added, only. Search filters the deck;
   the FAB in the bottom navigation opens the Add-a-word flow. (Browsing the
   full 14k bundled dictionary is gone: words enter the deck via capture now.) */
export function Browse({
  entries,
  levels,
  tricky,
  onRemove,
  onEdit,
}: {
  /** The user's deck words, resolved to dictionary content (newest first). */
  entries: DictionaryEntry[];
  /** Ladder level per deck word id (from its spaced-repetition state). */
  levels: Map<string, number>;
  /** Deck word ids flagged as leeches (4+ lapses). */
  tricky: Set<string>;
  onRemove: (entryId: string) => void;
  /** Corrects a saved word's translation and example — the general form of
   *  the sense picker's override, for the words that never had a picker. */
  onEdit: (entryId: string, edit: Edit) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // The row being edited, and its draft — separate from `entries` so typing
  // doesn't touch anything until Save. Only one row can be mid-edit at once.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Edit>({ english: "", example: "", exampleEn: "" });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.dutch.toLowerCase().includes(q) || e.english.toLowerCase().includes(q)
    );
  }, [query, entries]);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
    setEditingId(null); // collapsing (or opening a different row) exits editing without saving
  }

  function startEdit(e: DictionaryEntry) {
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
        search={
          entries.length > 0
            ? { value: query, onChange: setQuery, placeholder: "Search Dutch or English…" }
            : undefined
        }
      />

      <div className="screen__body gutter" style={{ paddingTop: 14, paddingBottom: 20 }}>
        {entries.length === 0 ? (
          <p className="muted" style={{ fontSize: 15, padding: "30px 4px", textAlign: "center" }}>
            Your deck is empty. Tap + to look up a word and add it here.
          </p>
        ) : results.length === 0 ? (
          <p className="muted" style={{ fontSize: 15, padding: "30px 4px", textAlign: "center" }}>
            No deck words match “{query}”.
          </p>
        ) : (
          <div className="wordlist">
            {results.map((e) => {
              const open = openId === e.id;
              const editing = editingId === e.id;
              return (
                <div key={e.id} className="wordrow">
                  <div className="wordrow__row">
                    <div className="wordrow__main">
                      <IconButton
                        action="expand"
                        variant="no-background"
                        onClick={() => toggle(e.id)}
                        aria-expanded={open}
                        aria-label={open ? `Collapse ${e.dutch}` : `Show ${e.dutch} in context`}
                      />
                      <div className="wordrow__content">
                        <span className="wordrow__head">
                          <GenderChip gender={e.gender} size="sm" />
                          <span className="wordrow__dutch">{e.dutch}</span>
                          {tricky.has(e.id) && <span className="tricky-tag">Tricky</span>}
                        </span>
                        <span className="wordrow__gloss">{e.english}</span>
                      </div>
                    </div>
                    <MasteryBar level={levels.get(e.id) ?? 0} withLabel />
                    <IconButton
                      action="remove"
                      onClick={() => onRemove(e.id)}
                      aria-label={`Remove ${e.dutch} from deck`}
                    />
                  </div>

                  {open && (
                    <div className="wordrow__context">
                      <div className="wordrow__rule" />
                      {editing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <label className="auth-field">
                            <span className="auth-field__label">Translation</span>
                            <input
                              className="text-input"
                              value={draft.english}
                              onChange={(ev) => setDraft({ ...draft, english: ev.target.value })}
                              autoFocus
                            />
                          </label>
                          <label className="auth-field">
                            <span className="auth-field__label">Example (Dutch)</span>
                            <input
                              className="text-input"
                              value={draft.example}
                              onChange={(ev) => setDraft({ ...draft, example: ev.target.value })}
                            />
                          </label>
                          <label className="auth-field">
                            <span className="auth-field__label">Example (English)</span>
                            <input
                              className="text-input"
                              value={draft.exampleEn}
                              onChange={(ev) => setDraft({ ...draft, exampleEn: ev.target.value })}
                            />
                          </label>
                          <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                            <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                            <button
                              className="btn btn--primary"
                              style={{ flex: 1 }}
                              disabled={!draft.english.trim()}
                              onClick={() => saveEdit(e.id)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="eyebrow">In context</div>
                          {e.example ? (
                            <div className="wordrow__example">
                              <div className="wordrow__example-nl">{e.example}</div>
                              <div className="wordrow__example-en">{e.exampleEn}</div>
                            </div>
                          ) : (
                            <div className="faint" style={{ fontSize: 13 }}>
                              No example sentence yet — the flashcard shows the translation.
                            </div>
                          )}
                          <button
                            className="link-btn"
                            style={{ marginTop: 10, alignSelf: "flex-start" }}
                            onClick={() => startEdit(e)}
                          >
                            Edit translation
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { Wordmark } from "../components/brand";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { MasteryBar } from "../components/MasteryBar";
import { SearchIcon } from "../components/icons";

/* Deck screen — the words the user has added, only. Search filters the deck;
   the foot button opens the Add-a-word flow. (Browsing the full 14k bundled
   dictionary is gone: words enter the deck via capture now.) */
export function Browse({
  entries,
  levels,
  tricky,
  onRemove,
  onAddWord,
}: {
  /** The user's deck words, resolved to dictionary content (newest first). */
  entries: DictionaryEntry[];
  /** Ladder level per deck word id (from its spaced-repetition state). */
  levels: Map<string, number>;
  /** Deck word ids flagged as leeches (4+ lapses). */
  tricky: Set<string>;
  onRemove: (entryId: string) => void;
  onAddWord: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.dutch.toLowerCase().includes(q) || e.english.toLowerCase().includes(q)
    );
  }, [query, entries]);

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 12px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Your deck</h1>
        <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 0" }}>
          {entries.length.toLocaleString()} word{entries.length === 1 ? "" : "s"} · tap a word to see it in context
        </p>
        {entries.length > 0 && (
          <label className="field" style={{ marginTop: 14 }}>
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your deck…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{ fontFamily: "var(--font-sans)", fontSize: 16 }}
            />
          </label>
        )}
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 20 }}>
        {entries.length === 0 ? (
          <p className="muted" style={{ fontSize: 15, padding: "30px 4px", textAlign: "center" }}>
            Your deck is empty. Add a word to start.
          </p>
        ) : results.length === 0 ? (
          <p className="muted" style={{ fontSize: 15, padding: "30px 4px", textAlign: "center" }}>
            No deck words match “{query}”.
          </p>
        ) : (
          <div className="wordlist">
            {results.map((e) => {
              const open = openId === e.id;
              return (
                <div key={e.id} className="wordrow wordrow--selected">
                  <div className="wordrow__row">
                    <div className="wordrow__main">
                      <IconButton
                        action="expand"
                        variant="no-background"
                        onClick={() => setOpenId(open ? null : e.id)}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="gutter" style={{ padding: "10px 22px 24px" }}>
        <button className="btn btn--primary" onClick={onAddWord}>
          Add a new word to deck
        </button>
      </div>
    </div>
  );
}

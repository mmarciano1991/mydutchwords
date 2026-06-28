import { useMemo, useState } from "react";
import { DICTIONARY } from "../data/dictionary";
import { Wordmark } from "../components/brand";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { MasteryBar } from "../components/MasteryBar";
import { SearchIcon } from "../components/icons";

const RENDER_LIMIT = 120;

export function Browse({
  deckIds,
  recalls,
  onToggle,
}: {
  deckIds: Set<string>;
  recalls: Map<string, number>;
  onToggle: (entryId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Sort the whole dictionary once; filtering keeps that order.
  const sorted = useMemo(
    () => [...DICTIONARY].sort((a, b) => a.dutch.localeCompare(b.dutch, "nl")),
    []
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (e) => e.dutch.toLowerCase().includes(q) || e.english.toLowerCase().includes(q)
    );
  }, [query, sorted]);

  const shown = results.slice(0, RENDER_LIMIT);

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 12px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Dictionary</h1>
        <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 0" }}>
          {DICTIONARY.length.toLocaleString()} words · tap + to add to your deck
        </p>
        <label className="field" style={{ marginTop: 14 }}>
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Dutch or English…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{ fontFamily: "var(--font-sans)", fontSize: 16 }}
          />
        </label>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        {results.length === 0 ? (
          <p className="muted" style={{ fontSize: 15, padding: "30px 4px", textAlign: "center" }}>
            No words match “{query}”.
          </p>
        ) : (
          <>
            <div className="wordlist">
              {shown.map((e) => {
                const added = deckIds.has(e.id);
                const open = openId === e.id;
                return (
                  <div key={e.id} className="wordrow">
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
                          </span>
                          <span className="wordrow__gloss">{e.english}</span>
                        </div>
                      </div>
                      {added && <MasteryBar recalls={recalls.get(e.id) ?? 0} withLabel />}
                      <IconButton
                        action="add"
                        success={added}
                        onClick={() => onToggle(e.id)}
                        aria-label={added ? `Remove ${e.dutch}` : `Add ${e.dutch}`}
                        aria-pressed={added}
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

            {results.length > RENDER_LIMIT && (
              <p className="faint" style={{ fontSize: 12.5, textAlign: "center", marginTop: 16 }}>
                Showing {RENDER_LIMIT} of {results.length.toLocaleString()} — keep typing to narrow.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

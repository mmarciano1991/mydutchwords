import { useMemo, useState } from "react";
import { DICTIONARY } from "../data/dictionary";
import { Wordmark } from "../components/brand";
import { GenderChip } from "../components/GenderChip";
import { SearchIcon, PlusIcon } from "../components/icons";

export function Browse({
  deckIds,
  onToggle,
}: {
  deckIds: Set<string>;
  onToggle: (entryId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? DICTIONARY.filter(
          (e) => e.dutch.toLowerCase().includes(q) || e.english.toLowerCase().includes(q)
        )
      : DICTIONARY;
    return [...list].sort((a, b) => a.dutch.localeCompare(b.dutch, "nl"));
  }, [query]);

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 12px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Dictionary</h1>
        <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 0" }}>
          {DICTIONARY.length} words · tap + to add to your deck
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
          <div className="wordlist">
            {results.map((e) => {
              const added = deckIds.has(e.id);
              const open = openId === e.id;
              return (
                <div key={e.id}>
                  <div className="wordrow" style={{ gap: 11 }}>
                    <button
                      onClick={() => setOpenId(open ? null : e.id)}
                      aria-expanded={open}
                      style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 13, background: "none", border: "none", textAlign: "left", padding: 0 }}
                    >
                      <span className="dot" />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="wordrow__dutch" style={{ display: "block" }}>{e.dutch}</span>
                        <span className="wordrow__gloss" style={{ display: "block" }}>{e.english}</span>
                      </span>
                      <GenderChip gender={e.gender} size="sm" />
                    </button>
                    <button
                      className={`addbtn${added ? " addbtn--on" : ""}`}
                      onClick={() => onToggle(e.id)}
                      aria-label={added ? `Remove ${e.dutch}` : `Add ${e.dutch}`}
                      aria-pressed={added}
                    >
                      {added ? (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M3.5 9.2l3.2 3.2L14.5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <PlusIcon size={18} color="#1B4079" />
                      )}
                    </button>
                  </div>

                  {open && (
                    <div className="card" style={{ marginTop: 8, padding: "14px 18px", borderRadius: 16 }}>
                      <div className="eyebrow" style={{ marginBottom: 7 }}>In context</div>
                      <div className="quote">{e.example}</div>
                      <div className="faint" style={{ fontSize: 13, marginTop: 5 }}>{e.exampleEn}</div>
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

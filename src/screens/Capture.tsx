/* Capture — "Add a word" flow (product flowchart + Figma 130:232).
   Type a Dutch word → instant lookup in the bundled dictionary → if absent,
   search Wiktionary online → if still absent, spelling suggestions.
   A found word shows the three treatment choices: save to study, mark as
   already known (skips the ramp, straight to Mature), or don't add. */
import { useMemo, useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { lookupLocal, suggestWords } from "../lib/wordSources";
import { lookupWiktionary } from "../lib/wiktionary";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { Notice } from "../components/Notice";
import { SearchIcon } from "../components/icons";
import { Check, Close } from "../icons";

type Phase =
  | { kind: "idle" }
  | { kind: "found"; entry: DictionaryEntry; duplicate: boolean }
  | { kind: "searching" }
  | { kind: "notFound"; suggestions: DictionaryEntry[] };

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
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const searchSeq = useRef(0);

  const trimmed = query.trim();

  // Live local lookup while typing (cheap, offline).
  const localHit = useMemo(() => (trimmed ? lookupLocal(trimmed) : undefined), [trimmed]);

  // A local hit always wins; otherwise show whatever the async flow produced.
  // (edit() resets `phase` on every keystroke, so it can never be stale.)
  const shown: Phase = localHit
    ? { kind: "found", entry: localHit, duplicate: deckIds.has(localHit.id) }
    : phase;

  function edit(value: string) {
    setQuery(value);
    searchSeq.current++; // invalidate any in-flight online search
    setPhase({ kind: "idle" });
  }

  async function searchOnline() {
    if (!trimmed || localHit) return;
    const seq = ++searchSeq.current;
    setPhase({ kind: "searching" });
    const entry = await lookupWiktionary(trimmed);
    if (seq !== searchSeq.current) return; // stale response — query changed
    if (entry) {
      setPhase({ kind: "found", entry, duplicate: deckIds.has(entry.id) });
    } else {
      setPhase({ kind: "notFound", suggestions: suggestWords(trimmed) });
    }
  }

  const found = shown.kind === "found" ? shown : null;

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
            void searchOnline();
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

              <button className="capture-option" onClick={onBack}>
                <span className="capture-option__icon">
                  <Close size={18} />
                </span>
                <span className="capture-option__text">
                  <span className="capture-option__title capture-option__title--muted">Don&rsquo;t add it</span>
                  <span className="capture-option__sub">Never enters practice — not the same as known</span>
                </span>
              </button>
            </div>
          </>
        )}

        {shown.kind === "idle" && trimmed.length > 0 && !localHit && (
          <p className="muted" style={{ fontSize: 14, margin: "16px 2px 0" }}>
            Not in the built-in dictionary. Press Enter to search online.
          </p>
        )}

        {shown.kind === "searching" && (
          <p className="muted" style={{ fontSize: 14, margin: "16px 2px 0" }}>
            Searching online…
          </p>
        )}

        {shown.kind === "notFound" && (
          <div style={{ marginTop: 16 }}>
            <Notice type="caution">
              No translation found. Check the spelling{shown.suggestions.length > 0 ? " — or did you mean:" : "."}
            </Notice>
            {shown.suggestions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {shown.suggestions.map((s) => (
                  <button key={s.id} className="suggestion-chip" onClick={() => edit(s.dutch)}>
                    {s.dutch}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

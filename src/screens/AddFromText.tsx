/* AddFromText — "Add from text" (2a): paste or type Dutch you're already
   reading, tap any word to look it up, and — automatically, no extra field
   to fill in — the sentence it came from is captured alongside it (see
   types.ts, DictionaryEntry.metIn, and docs/recommendations.md item 1c).

   This is the structural fix for "read an article, capture a word you don't
   know": until now that meant retyping a word from another tab, which asks
   a learner to spell correctly the one thing they don't yet know how to
   spell. Tapping it here instead needs no retyping and no guessing.

   Two states: editing the pasted text, and reading it with tap targets once
   it's frozen. Reuses the exact same lookup pipeline and result rendering as
   Capture (useWordLookup / WordLookupResult) — only how a word gets chosen,
   and what happens to it once resolved, differs. */
import { useMemo, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { tokenizeText, type TextToken } from "../lib/tokenizeText";
import { useWordLookup } from "../lib/useWordLookup";
import { Appbar } from "../components/Appbar";
import { Notice } from "../components/Notice";
import { WordLookupResult } from "../components/WordLookupResult";

export function AddFromText({
  deckIds,
  levels,
  onSave,
  onBack,
}: {
  deckIds: Set<string>;
  levels: Map<string, number>;
  onSave: (entry: DictionaryEntry) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  // The text becomes tap targets once frozen — editing it again clears
  // everything below, since token positions (and any active lookup) would
  // no longer line up with a changed text.
  const [frozenText, setFrozenText] = useState<string | null>(null);
  const [active, setActive] = useState<{ token: TextToken; index: number } | null>(null);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [addedCount, setAddedCount] = useState(0);

  const { tokens, sentences } = useMemo(
    () => (frozenText ? tokenizeText(frozenText) : { tokens: [], sentences: [] }),
    [frozenText]
  );

  // Feeds whichever word is currently tapped through the same resolution
  // pipeline Capture uses — sense picker, deinflection and all. Idle (no
  // lookup work at all) whenever nothing is tapped, since the query is "".
  const lookup = useWordLookup(active?.token.text ?? "");

  function startReading() {
    if (!draft.trim()) return;
    setFrozenText(draft);
    setActive(null);
    setAddedIndices(new Set());
    setAddedCount(0);
  }

  function editText() {
    setFrozenText(null);
    setActive(null);
  }

  /** The word's own sentence, unambiguous because a tap always resolves to
   *  exactly one token at one position — there's nothing to ask the user. */
  function save(entry: DictionaryEntry) {
    if (!active) return;
    const sentence = sentences[active.token.sentenceIndex];
    onSave({ ...entry, metIn: sentence });
    setAddedIndices((prev) => new Set(prev).add(active.index));
    setAddedCount((n) => n + 1);
    setActive(null);
  }

  if (!frozenText) {
    return (
      <div className="screen">
        <Appbar title="Add from text" onBack={onBack} />
        <div
          className="screen__body gutter"
          style={{ paddingTop: 16, paddingBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}
        >
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>
            Paste or type a bit of Dutch — an article, a letter, a sign. Once
            you&rsquo;re reading it here, tap any word to look it up and add it,
            with the sentence you found it in kept alongside.
          </p>
          <textarea
            className="text-input"
            style={{ minHeight: 220, resize: "vertical", fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.5 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Plak of typ hier een stukje Nederlandse tekst…"
            // The placeholder is deliberately Dutch (it's a prompt for Dutch
            // input), so it can't double as the accessible name for an
            // English-language screen reader user — this says the same
            // thing the paragraph above it does, in English.
            aria-label="Dutch text to read and capture words from"
            autoFocus
          />
          <button className="btn btn--primary" disabled={!draft.trim()} onClick={startReading}>
            Start reading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Appbar title="Add from text" onBack={onBack} />
      <div className="screen__body gutter" style={{ paddingTop: 16, paddingBottom: 24 }}>
        {addedCount > 0 && (
          <Notice type="success">
            {addedCount} word{addedCount === 1 ? "" : "s"} added this visit
          </Notice>
        )}

        <p className="readtext" style={{ marginTop: addedCount > 0 ? 14 : 0 }}>
          {tokens.map((t, i) =>
            t.isWord ? (
              <button
                key={i}
                className={[
                  "readtext__word",
                  active?.index === i ? "readtext__word--active" : "",
                  addedIndices.has(i) ? "readtext__word--added" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setActive({ token: t, index: i })}
                aria-label={addedIndices.has(i) ? `${t.text}, already added to your deck` : undefined}
              >
                {t.text}
              </button>
            ) : (
              <span key={i}>{t.text}</span>
            )
          )}
        </p>

        <button className="link-btn" style={{ marginTop: 16 }} onClick={editText}>
          Edit the text
        </button>

        {active && (
          <div className="addword__block" style={{ marginTop: 20 }}>
            <div className="eyebrow">&ldquo;{active.token.text}&rdquo;</div>
            <WordLookupResult lookup={lookup} deckIds={deckIds} levels={levels} onSave={save} />
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import type { DictionaryEntry, PracticeResult } from "../lib/types";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";

export function Practice({
  entries,
  onFinish,
  onClose,
}: {
  entries: DictionaryEntry[];
  onFinish: (results: PracticeResult[]) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<PracticeResult[]>([]);

  const total = entries.length;
  const entry = entries[index];

  function answer(knew: boolean) {
    const next = [...results, { entryId: entry.id, knew, timestamp: Date.now() }];
    if (index + 1 >= total) {
      onFinish(next);
      return;
    }
    setResults(next);
    setIndex(index + 1);
    setFlipped(false);
  }

  const progress = (index / total) * 100;

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <IconButton action="close" onClick={onClose} aria-label="Close practice" />
        <div className="progress">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
          {index + 1}/{total}
        </span>
      </div>

      <div className="screen__body gutter" style={{ padding: "14px 22px 4px", display: "flex", flexDirection: "column" }}>
        <div className="eyebrow" style={{ textAlign: "center" }}>
          {flipped ? "Translation" : "Do you know this word?"}
        </div>

        <button
          className="flashcard"
          onClick={() => setFlipped((f) => !f)}
          aria-label="Flip card"
        >
          {!flipped ? (
            <div className="flashcard__face">
              <span className="flashcard__label">Dutch</span>
              <div className="flashcard__word">{entry.dutch}</div>
              <div className="flashcard__hint">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9a6 6 0 1010-4.5M3 9l-1.5-2M3 9l2-1.5" stroke="#A9B2C2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Tap to flip
              </div>
            </div>
          ) : (
            <div className="flashcard__face flashcard__face--back">
              <GenderChip gender={entry.gender} />
              <div className="flashcard__translation">{entry.english}</div>
              {entry.example && (
                <>
                  <div className="flashcard__rule" />
                  <div className="quote" style={{ fontStyle: "italic", color: "#46546F", textAlign: "center" }}>
                    {entry.example}
                  </div>
                  <div className="faint" style={{ fontSize: 13, marginTop: 6, textAlign: "center" }}>
                    {entry.exampleEn}
                  </div>
                </>
              )}
            </div>
          )}
        </button>
      </div>

      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", gap: 12 }}>
        <button className="btn btn--still" onClick={() => answer(false)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="#B5462F" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Still learning
        </button>
        <button className="btn btn--success" onClick={() => answer(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.2 3.2L13 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          I knew it
        </button>
      </div>
    </div>
  );
}

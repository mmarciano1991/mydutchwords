import { useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { applyGrade, type Grade, type ReviewedCard, type Word } from "../lib/learningEngine";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { Divider } from "../components/Divider";

export interface PracticeCard {
  entry: DictionaryEntry;
  word: Word;
}

export function Practice({
  queue,
  onFinish,
  onClose,
}: {
  queue: PracticeCard[];
  onFinish: (reviewedCards: ReviewedCard[]) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<ReviewedCard[]>([]);

  const total = queue.length;
  const { entry, word } = queue[index];

  function grade(g: Grade) {
    const updated = applyGrade(word, g, new Date());
    const next = [...reviewed, { word: updated, grade: g }];
    if (index + 1 >= total) {
      onFinish(next);
      return;
    }
    setReviewed(next);
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
          <div className={`flashcard__inner${flipped ? " is-flipped" : ""}`}>
            <div className="flashcard__face flashcard__face--front">
              <GenderChip gender={entry.gender} />
              <div className="flashcard__word">{entry.dutch}</div>
              {entry.example && <Divider />}
              {entry.example && <div className="flashcard__example">{entry.example}</div>}
              <div className="flashcard__hint">Tap to flip</div>
            </div>
            <div className="flashcard__face flashcard__face--back">
              <GenderChip gender={entry.gender} />
              <div className="flashcard__word">{entry.english}</div>
              {entry.exampleEn && <Divider />}
              {entry.exampleEn && <div className="flashcard__example">{entry.exampleEn}</div>}
              <div className="flashcard__hint">Tap to flip</div>
            </div>
          </div>
        </button>
      </div>

      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", gap: 12 }}>
        <button className="btn btn--difficult" onClick={() => grade("dontKnow")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="#B5462F" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Still learning
        </button>
        <button className="btn btn--success" onClick={() => grade("know")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.2 3.2L13 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          I knew it
        </button>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { applyGrade, type Grade, type ReviewedCard, type Word } from "../lib/learningEngine";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { Divider } from "../components/Divider";

export interface PracticeCard {
  entry: DictionaryEntry;
  word: Word;
}

/* In-session repeat (per the product flowchart): a missed card is re-queued
   at the end of the session so the user retries it minutes later, until it's
   answered correctly — capped at MAX_RECYCLES retries per card so a stubborn
   word can't trap the session. Every attempt applies a real grade (miss −1 /
   know +1), so a miss-then-recover nets out at the original level. */
const MAX_RECYCLES = 2;

/** Per-word outcome across attempts: first-attempt grade decides the report's
 *  correct count; the latest word state is what gets persisted. */
interface Outcome {
  firstGrade: Grade;
  word: Word;
}

export function Practice({
  queue: initialQueue,
  scheduling = true,
  onFinish,
  onClose,
}: {
  queue: PracticeCard[];
  /** false = warm-up (ahead-of-schedule): answers are not graded into the ladder. */
  scheduling?: boolean;
  onFinish: (reviewedCards: ReviewedCard[]) => void;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<PracticeCard[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const outcomes = useRef<Map<string, Outcome>>(new Map());
  const recycles = useRef<Map<string, number>>(new Map());

  const { entry, word } = queue[index];
  const isRepeat = outcomes.current.has(word.id);

  function grade(g: Grade) {
    const updated = scheduling ? applyGrade(word, g, new Date()) : word;

    const existing = outcomes.current.get(word.id);
    outcomes.current.set(word.id, {
      firstGrade: existing ? existing.firstGrade : g,
      word: updated,
    });

    let nextQueue = queue;
    if (g === "dontKnow" && (recycles.current.get(word.id) ?? 0) < MAX_RECYCLES) {
      recycles.current.set(word.id, (recycles.current.get(word.id) ?? 0) + 1);
      nextQueue = [...queue, { entry, word: updated }];
      setQueue(nextQueue);
    }

    if (index + 1 >= nextQueue.length) {
      onFinish(
        Array.from(outcomes.current.values()).map((o) => ({ word: o.word, grade: o.firstGrade }))
      );
      return;
    }
    setIndex(index + 1);
    setFlipped(false);
  }

  const progress = (index / queue.length) * 100;

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <IconButton action="close" onClick={onClose} aria-label="Close practice" />
        <div className="progress">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
          {index + 1}/{queue.length}
        </span>
      </div>

      <div className="screen__body gutter" style={{ padding: "14px 22px 4px", display: "flex", flexDirection: "column" }}>
        <div className="eyebrow" style={{ textAlign: "center" }}>
          {flipped ? "Translation" : isRepeat ? "One more try" : scheduling ? "Do you know this word?" : "Warm-up — does not change your schedule"}
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

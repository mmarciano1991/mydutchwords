import { useEffect, useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { applyGrade, type Grade, type ReviewedCard, type Word } from "../lib/learningEngine";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { Divider } from "../components/Divider";
import { Check, Close } from "../icons";

export interface PracticeCard {
  entry: DictionaryEntry;
  word: Word;
}

export function Practice({
  queue,
  scheduling = true,
  onAnswer,
  onGrade,
  onFinish,
  onClose,
}: {
  queue: PracticeCard[];
  /** false = warm-up (ahead-of-schedule): answers are not graded into the ladder. */
  scheduling?: boolean;
  /** Fired for EVERY answer, warm-up included, as it is given. This is what
   *  the practice run records, and so what the dashboard's card reports — a
   *  warm-up that goes badly has to be visible as such, even though it
   *  deliberately leaves the schedule alone. */
  onAnswer?: (wordId: string, grade: Grade) => void;
  /** Fired for every answer that is graded onto the ladder. Not called in
   *  warm-up: those answers deliberately don't move the schedule. */
  onGrade?: (card: ReviewedCard) => void;
  onFinish: (reviewedCards: ReviewedCard[]) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(0);
  // Transient per-answer feedback ("Next review in 3 days"), keyed so the
  // fade animation restarts on every grade; cleared by timer (JS, not CSS,
  // so it also disappears under prefers-reduced-motion).
  const [feedback, setFeedback] = useState<{ text: string; key: number } | null>(null);
  const feedbackTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);
  const reviewed = useRef<ReviewedCard[]>([]);

  const { entry, word } = queue[index];

  // A miss is graded and the card moves on — it doesn't come back later in
  // this same sitting. Recognizing it again a few seconds after missing it
  // is priming, not recall, and would let a word register as "known" without
  // ever having been actually retrieved. The ladder already reschedules a
  // miss for its next due date (learningEngine.applyGrade); that's where the
  // retry belongs, not an in-session loop.
  function grade(g: Grade) {
    const updated = scheduling ? applyGrade(word, g, new Date()) : word;

    // Hand the answer up now rather than at onFinish. The session can end in
    // ways that never reach onFinish — the close button, a backgrounded tab
    // the OS reclaims — and an answer the user gave is not the app's to lose.
    onAnswer?.(word.id, g);
    if (scheduling) onGrade?.({ word: updated, grade: g });
    reviewed.current.push({ word: updated, grade: g });
    setFinished((n) => n + 1);

    // Make the schedule legible: say when this word comes back.
    if (scheduling) {
      const text = `Next review in ${updated.interval} day${updated.interval === 1 ? "" : "s"}`;
      setFeedback({ text, key: Date.now() });
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1600);
    }

    if (index + 1 >= queue.length) {
      onFinish(reviewed.current);
      return;
    }
    setIndex(index + 1);
    setFlipped(false);
  }

  const progress = (finished / queue.length) * 100;

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <IconButton action="close" onClick={onClose} aria-label="Close practice" />
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={finished}
          aria-valuemin={0}
          aria-valuemax={queue.length}
          aria-valuetext={`${finished} of ${queue.length} words done`}
        >
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
          {finished}/{queue.length}
        </span>
      </div>

      <div className="screen__body gutter" style={{ padding: "14px 22px 4px", display: "flex", flexDirection: "column" }}>
        <div className="eyebrow" style={{ textAlign: "center" }}>
          {flipped ? "Translation" : scheduling ? "Do you know this word?" : "Warm-up — does not change your schedule"}
        </div>

        <button className="flashcard" onClick={() => setFlipped((f) => !f)}>
          <div className={`flashcard__inner${flipped ? " is-flipped" : ""}`}>
            {/* No aria-label on the button itself: an explicit label would
                replace this whole subtree as the accessible name, which is
                exactly what made the card silent to a screen reader (see
                docs/pilot-readiness-report.md, C1). The button's name now
                composes from whichever face is actually showing. Both faces
                stay in the DOM at all times (the 3D flip needs that), so
                each face's aria-hidden is toggled by `flipped` explicitly —
                without it, the not-currently-showing face's text risks
                being included in the accessible name too (CSS
                backface-visibility isn't one of the hiding techniques name
                computation is guaranteed to respect), which would read the
                translation and the word out together and give the answer
                away before it's earned. */}
            <div className="flashcard__face flashcard__face--front" aria-hidden={flipped}>
              <GenderChip gender={entry.gender} />
              <div className="flashcard__word">{entry.dutch}</div>
              {entry.example && <Divider />}
              {entry.example && <div className="flashcard__example">{entry.example}</div>}
              <div className="flashcard__hint" aria-hidden="true">Tap to flip</div>
            </div>
            <div className="flashcard__face flashcard__face--back" aria-hidden={!flipped}>
              <GenderChip gender={entry.gender} />
              <div className="flashcard__word">{entry.english}</div>
              {entry.exampleEn && <Divider />}
              {entry.exampleEn && <div className="flashcard__example">{entry.exampleEn}</div>}
              <div className="flashcard__hint" aria-hidden="true">Tap to flip</div>
            </div>
          </div>
        </button>
      </div>

      {feedback && (
        <div key={feedback.key} className="grade-toast" role="status">
          {feedback.text}
        </div>
      )}

      {/* Grading is offered on both faces. Recall happens before the flip —
          you either had the word or you didn't — so a learner who knows it
          can answer straight away instead of flipping to a translation they
          didn't need. Keeping the row mounted on both faces also means the
          card no longer jumps up as buttons appear underneath it. The card
          itself stays the only reveal affordance: no "Show translation"
          button duplicating the tap-to-flip gesture. */}
      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", gap: 12 }}>
        <button className="btn btn--difficult" onClick={() => grade("dontKnow")}>
          <Close size={16} />
          Still learning
        </button>
        <button className="btn btn--success" onClick={() => grade("know")}>
          <Check size={16} />
          I knew it
        </button>
      </div>
    </div>
  );
}

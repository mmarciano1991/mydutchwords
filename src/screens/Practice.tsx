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

/* In-session repeat (per the product flowchart): a missed card is re-queued
   at the end of the session so the user retries it minutes later, until it's
   answered correctly — capped at MAX_RECYCLES retries per card so a stubborn
   word can't trap the session. Every attempt applies a real grade (miss −1 /
   know +1), so a miss-then-recover nets out at the original level.

   The header therefore reports words finished out of words in the session,
   never cards seen out of cards queued: a re-queued card used to raise both
   halves of the count, so missing one read as "the session just got longer",
   which is a punishment the design never intended. Now the denominator is
   fixed at the session's distinct words and the bar advances only when a
   word is done with, so a miss holds the bar still — that word isn't
   finished yet, and the card's "One more try" says why it's back. */
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
  onGrade,
  onFinish,
  onClose,
}: {
  queue: PracticeCard[];
  /** false = warm-up (ahead-of-schedule): answers are not graded into the ladder. */
  scheduling?: boolean;
  /** Fired for every graded answer, as it's given, so nothing depends on the
   *  session being finished. Not called in warm-up: those answers are
   *  deliberately not written anywhere. */
  onGrade?: (card: ReviewedCard) => void;
  onFinish: (reviewedCards: ReviewedCard[]) => void;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<PracticeCard[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Progress counts distinct words, not cards shown, so the target is fixed
  // for the session's whole life: retries are extra attempts at a word you
  // already have, never extra work. `total` is read once — the queue itself
  // grows as cards recycle, which is exactly what it must not track.
  const [total] = useState(initialQueue.length);
  const [finished, setFinished] = useState(0);
  // Transient per-answer feedback ("Next review in 3 days"), keyed so the
  // fade animation restarts on every grade; cleared by timer (JS, not CSS,
  // so it also disappears under prefers-reduced-motion).
  const [feedback, setFeedback] = useState<{ text: string; key: number } | null>(null);
  const feedbackTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);
  const outcomes = useRef<Map<string, Outcome>>(new Map());
  const recycles = useRef<Map<string, number>>(new Map());

  const { entry, word } = queue[index];
  const isRepeat = outcomes.current.has(word.id);

  function grade(g: Grade) {
    const updated = scheduling ? applyGrade(word, g, new Date()) : word;

    // Hand the answer up now rather than at onFinish. The session can end in
    // ways that never reach onFinish — the close button, a backgrounded tab
    // the OS reclaims — and an answer the user gave is not the app's to lose.
    if (scheduling) onGrade?.({ word: updated, grade: g });

    const existing = outcomes.current.get(word.id);
    outcomes.current.set(word.id, {
      firstGrade: existing ? existing.firstGrade : g,
      word: updated,
    });

    let nextQueue = queue;
    const willRecycle = g === "dontKnow" && (recycles.current.get(word.id) ?? 0) < MAX_RECYCLES;
    if (willRecycle) {
      recycles.current.set(word.id, (recycles.current.get(word.id) ?? 0) + 1);
      nextQueue = [...queue, { entry, word: updated }];
      setQueue(nextQueue);
    } else {
      // The word is done with — known, or out of retries — so it leaves the
      // queue and the bar moves. A miss that comes back around leaves the bar
      // where it is: that word simply isn't finished yet. Each word can reach
      // here only once, so this counts distinct words.
      setFinished((n) => n + 1);
    }

    // Make the schedule legible: say when this word comes back.
    if (scheduling) {
      const text =
        g === "know"
          ? `Next review in ${updated.interval} day${updated.interval === 1 ? "" : "s"}`
          : willRecycle
            ? "One more try coming up"
            : "Coming back tomorrow";
      setFeedback({ text, key: Date.now() });
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1600);
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

  const progress = (finished / total) * 100;

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <IconButton action="close" onClick={onClose} aria-label="Close practice" />
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={finished}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={`${finished} of ${total} words done`}
        >
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
          {finished}/{total}
        </span>
      </div>

      <div className="screen__body gutter" style={{ padding: "14px 22px 4px", display: "flex", flexDirection: "column" }}>
        <div className="eyebrow" style={{ textAlign: "center" }}>
          {flipped ? "Translation" : isRepeat ? "One more try" : scheduling ? "Do you know this word?" : "Warm-up — does not change your schedule"}
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

      {/* Grading is only offered once the answer is on screen. Both buttons
          used to be live under an unflipped card, next to a question asking
          whether you know the word — which invites answering a card you
          haven't tried to recall, and quietly turns self-assessment into
          guesswork. Revealing first is what makes the grade mean something
          (and is how Anki has always sequenced it). The card itself still
          flips on tap; this is the same gesture given a label. */}
      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", gap: 12 }}>
        {flipped ? (
          <>
            <button className="btn btn--difficult" onClick={() => grade("dontKnow")}>
              <Close size={16} />
              Still learning
            </button>
            <button className="btn btn--success" onClick={() => grade("know")}>
              <Check size={16} />
              I knew it
            </button>
          </>
        ) : (
          <button className="btn btn--primary" onClick={() => setFlipped(true)}>
            Show translation
          </button>
        )}
      </div>
    </div>
  );
}

/* PracticeCard — the dashboard's entry point into the day's flashcard set
   (Figma 304:1118). One card, four states:

     ready    — the set is drawn and untouched: how many words, "Start practice"
     progress — half-done: an inverted ProgressBar, words to go, "Continue"
     done     — finished: the knew-it / still-learning split and two ways to
                practise again
     caught-up — nothing was available to draw today (not a Figma variant;
                the real state the design's three don't cover)

   Per the component's Figma documentation there is only ever one on the
   dashboard, and everything nested inside it uses the inverted/on-cobalt
   treatment. */
import type { ReactNode } from "react";
import { CardsStack } from "../icons";
import { LearningDash } from "./LearningDash";
import { ProgressBar } from "./ProgressBar";

/* The design shows "7 min" against 10 queued words. Answering a card is a
   recall, not a read — a shade under three-quarters of a minute each. */
const MINUTES_PER_CARD = 0.7;

/** Rough session length in whole minutes, never rounded down to zero. */
export function sessionMinutes(cardCount: number): number {
  return Math.max(1, Math.round(cardCount * MINUTES_PER_CARD));
}

function Shell({ length, children }: { length: string | null; children: ReactNode }) {
  return (
    <section className="practice-card">
      <div className="practice-card__top">
        <CardsStack className="practice-card__icon" />
        <p className="practice-card__kind">Flashcards</p>
        {length && <p className="practice-card__length">{length}</p>}
      </div>
      {children}
    </section>
  );
}

export function PracticeCard({
  status,
  setSize,
  total,
  answered,
  knownCount,
  learningCount,
  nextDueLabel,
  onStart,
  onPractiseLearning,
  onPractiseAll,
  onPractiseAhead,
}: {
  status: "ready" | "progress" | "done" | "caught-up";
  /** Words drawn for today — the size of the day, not of the sitting. */
  setSize: number;
  /** Words in the current or most recent sitting. */
  total: number;
  /** How many of them are answered. */
  answered: number;
  knownCount: number;
  learningCount: number;
  /** Caught-up only: when the next review unlocks, e.g. "tomorrow". */
  nextDueLabel: string | null;
  /** Starts, or resumes, today's set. */
  onStart: () => void;
  /** Re-drills just the still-learning words. Ungraded. */
  onPractiseLearning: () => void;
  /** Re-drills the whole set. Ungraded. */
  onPractiseAll: () => void;
  /** Caught-up only: practise ahead of schedule. Ungraded. */
  onPractiseAhead: () => void;
}) {
  if (status === "caught-up") {
    return (
      <Shell length={null}>
        <div className="practice-card__content">
          <p className="practice-card__title">You&rsquo;re all set</p>
          <p className="practice-card__body">
            {nextDueLabel
              ? `Your next set is ${nextDueLabel}. Get a head start whenever you like.`
              : "Nothing is scheduled. Get a head start whenever you like."}
          </p>
        </div>
        <button className="practice-card__cta" onClick={onPractiseAhead}>
          Practise ahead
        </button>
      </Shell>
    );
  }

  if (status === "done") {
    return (
      <Shell length={`${sessionMinutes(total)} min`}>
        <div className="practice-card__content">
          <p className="practice-card__title">Mooi gedaan!</p>
          <p className="practice-card__body">Practice done for today.</p>
          <LearningDash known={knownCount} learning={learningCount} knownLabel="Knew it" />
        </div>
        <div className="practice-card__actions">
          {learningCount > 0 && (
            <button className="practice-card__cta" onClick={onPractiseLearning}>
              Practise {learningCount === 1 ? "this one" : `these ${learningCount}`} again
            </button>
          )}
          <button className="practice-card__link" onClick={onPractiseAll}>
            Practise all {setSize} again
          </button>
        </div>
      </Shell>
    );
  }

  if (status === "progress") {
    const left = total - answered;
    return (
      <Shell length={`${sessionMinutes(left)} min left`}>
        <div className="practice-card__content">
          <p className="practice-card__title">Your daily practice</p>
          <p className="practice-card__body">Pick up where you left off.</p>
        </div>
        {/* Forward-looking caption, per the ProgressBar's Figma notes: the
            filled part already carries what is done. */}
        <ProgressBar
          value={answered}
          max={total}
          label={`${left} word${left === 1 ? "" : "s"} to go`}
          variant="inverted"
        />
        <button className="practice-card__cta" onClick={onStart}>
          Continue
        </button>
      </Shell>
    );
  }

  return (
    <Shell length={`${sessionMinutes(setSize)} min`}>
      <div className="practice-card__content">
        <p className="practice-card__title">Your daily practice</p>
        <p className="practice-card__body">
          {setSize} word{setSize === 1 ? " is" : "s are"} ready for you.
        </p>
      </div>
      <button className="practice-card__cta" onClick={onStart}>
        Start practice
      </button>
    </Shell>
  );
}

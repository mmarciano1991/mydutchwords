/* PracticeCard — the dashboard's entry point into the day's flashcard set
   (Figma 304:1118). One card, five states:

     ready    — the set is drawn and untouched: how many words, "Start practice"
     progress — half-done: an inverted ProgressBar, words to go, "Continue"
     done     — finished: the knew-it / still-learning split and two ways to
                practise again
     inactive — too few words in the deck to draw a set from: the card goes
                pale and points at Add-a-word instead
     caught-up — nothing was available to draw today (not a Figma variant;
                the real state the design's four don't cover)

   Per the component's Figma documentation there is only ever one on the
   dashboard, and everything nested inside it uses the inverted/on-cobalt
   treatment — hence `btn--inverted` on every action but the inactive card's,
   which sits on a pale surface and so uses the plain contained button. */
import type { ReactNode } from "react";
import { CardsStack } from "../icons";
import { LearningDash } from "./LearningDash";
import { ProgressBar } from "./ProgressBar";

export type PracticeCardStatus = "ready" | "progress" | "done" | "caught-up" | "inactive";

/** Fewer words than this in the deck and there is nothing worth drawing a
 *  day's set from, so the card is inactive (Figma 322:1880). */
export const MIN_PRACTICE_WORDS = 16;

/* The design shows "7 min" against 10 queued words. Answering a card is a
   recall, not a read — a shade under three-quarters of a minute each. */
const MINUTES_PER_CARD = 0.7;

/** Rough session length in whole minutes, never rounded down to zero. */
export function sessionMinutes(cardCount: number): number {
  return Math.max(1, Math.round(cardCount * MINUTES_PER_CARD));
}

function Shell({
  length,
  inactive = false,
  children,
}: {
  length: string | null;
  inactive?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`practice-card${inactive ? " practice-card--inactive" : ""}`}>
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
  deckCount,
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
  onAddWord,
}: {
  status: PracticeCardStatus;
  /** Words saved in the deck. Inactive-only: what "you have only N" reports. */
  deckCount: number;
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
  /** Inactive only: opens Add-a-word. Takes the button so the screen can
   *  expand out of it, the same way the dashboard's empty state does. */
  onAddWord: (origin: HTMLElement) => void;
}) {
  // ── Inactive: the deck is too thin to practise from. No session length to
  //    report, and the only action is to keep adding words. ──
  if (status === "inactive") {
    return (
      <Shell length={null} inactive>
        <div className="practice-card__content">
          <p className="practice-card__title">Add more words</p>
          <p className="practice-card__body">
            You need at least {MIN_PRACTICE_WORDS} words to begin practising — you
            have only {deckCount}.
          </p>
        </div>
        <button className="btn btn--primary" onClick={(e) => onAddWord(e.currentTarget)}>
          Add a word
        </button>
      </Shell>
    );
  }

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
        <button className="btn btn--primary btn--inverted" onClick={onPractiseAhead}>
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
            <button className="btn btn--primary btn--inverted" onClick={onPractiseLearning}>
              Practise {learningCount === 1 ? "this one" : `these ${learningCount}`} again
            </button>
          )}
          <button className="btn btn--secondary btn--inverted" onClick={onPractiseAll}>
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
        <button className="btn btn--primary btn--inverted" onClick={onStart}>
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
      <button className="btn btn--primary btn--inverted" onClick={onStart}>
        Start practice
      </button>
    </Shell>
  );
}

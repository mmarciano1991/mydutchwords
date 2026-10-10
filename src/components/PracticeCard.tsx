/* PracticeCard — the dashboard's single entry point into today's Dutch
   (Figma 304:1118). Three states, all read from the day's GOAL rather than
   from a fixed-size set:

     ready    — nothing practised yet today: how many words wait, one button
     progress — part of the goal done: an inverted ProgressBar, "Continue"
     done     — the goal is reached (Figma 306:1223). A light card with a
                "Goal reached" badge says the day is finished and when
                tomorrow's session starts; under a divider, extra practice
                for TODAY is offered ("Keep going – N more words"), worded so
                it never reads as starting tomorrow's session early.

   The old "caught up / practise ahead" and "add 16 words before you can
   practise" states are gone: the daily set always tops up from the whole
   deck, and the goal never exceeds the deck, so there is always a way to
   finish the day.

   Per the component's Figma documentation there is only ever one on the
   dashboard, and everything nested inside it uses the inverted/on-cobalt
   treatment. */
import type { ReactNode } from "react";
import { CardsStack, CheckCircle } from "../icons";
import { ProgressBar } from "./ProgressBar";

/** ready / progress / done as above, plus `empty`: no full session today,
 *  but nothing is left to practise either (every word has had its graded
 *  answer today). Said plainly — never an empty or repeat session. */
export type PracticeCardStatus = "ready" | "progress" | "done" | "empty";

/** Rough session length in whole minutes: about half a minute a card (a
 *  recall, not a read), rounded down so the promise is never overstated —
 *  10 words ≈ 5 min, 20 ≈ 10, 30 ≈ 15, matching the commitment options.
 *  Never zero. */
export function sessionMinutes(cardCount: number): number {
  return Math.max(1, Math.floor(cardCount / 2));
}

function Shell({
  length,
  badge,
  variant,
  children,
}: {
  length: string | null;
  badge?: ReactNode;
  variant?: "progress" | "done";
  children: ReactNode;
}) {
  return (
    <section className={`practice-card${variant ? ` practice-card--${variant}` : ""}`}>
      <div className="practice-card__top">
        <CardsStack className="practice-card__icon" />
        <p className="practice-card__kind">Today&rsquo;s Dutch</p>
        {length && <p className="practice-card__length">{length}</p>}
        {badge}
      </div>
      {children}
    </section>
  );
}

export function PracticeCard({
  status,
  goal,
  towardGoal,
  tomorrow,
  canExtra,
  extraWords = 0,
  canReplay,
  onStart,
  onExtra,
  onReplay,
}: {
  status: PracticeCardStatus;
  /** Words that make today done. */
  goal: number;
  /** Of those, how many are done. */
  towardGoal: number;
  /** Habit cue — no longer shown on the card (Figma 304:1067); kept so
   *  callers needn't change. */
  cue?: string;
  /** " at 08:00", or "" without a reminder — completes "See you tomorrow…". */
  tomorrow: string;
  /** Whether anything is still eligible to practise today. */
  canExtra: boolean;
  /** Words the extra practice would hold (the next section's size). */
  extraWords?: number;
  /** Words can be gone over again, ungraded, once nothing is left to grade. */
  canReplay: boolean;
  /** Starts, or continues, today's goal. */
  onStart: () => void;
  /** A few more words, past the goal. */
  onExtra: () => void;
  /** Practise words again — ungraded, as often as the user likes. */
  onReplay: () => void;
}) {
  if (status === "empty") {
    return (
      <Shell length={null}>
        <div className="practice-card__content">
          <p className="practice-card__title">All caught up</p>
          <p className="practice-card__body">
            You&rsquo;re done for today &mdash; new words will be ready tomorrow.
          </p>
        </div>
        {canReplay && (
          <button className="btn btn--secondary btn--inverted" onClick={onReplay}>
            Practise again
          </button>
        )}
      </Shell>
    );
  }

  if (status === "done") {
    return (
      <Shell
        length={null}
        variant="done"
        badge={
          <span className="practice-card__badge">
            <CheckCircle size={24} />
            Goal reached
          </span>
        }
      >
        <div className="practice-card__content">
          <p className="practice-card__title">Today’s session is complete!</p>
          <p className="practice-card__body">Your next session starts tomorrow{tomorrow}.</p>
        </div>
        {(canExtra || canReplay) && (
          <>
            <hr className="practice-card__divider" />
            <div className="practice-card__more">
              <p className="practice-card__prompt">
                {canExtra ? "Still in the mood for more practice today?" : "Want to go over today’s words again?"}
              </p>
              {canExtra ? (
                <button className="btn btn--primary" onClick={onExtra}>
                  Keep going – {extraWords} more word{extraWords === 1 ? "" : "s"}
                </button>
              ) : (
                <button className="btn btn--primary" onClick={onReplay}>
                  Practise again
                </button>
              )}
            </div>
          </>
        )}
      </Shell>
    );
  }

  const left = goal - towardGoal;

  if (status === "progress") {
    return (
      <Shell length={`${sessionMinutes(left)} min left`} variant="progress">
        <div className="practice-card__content">
          <p className="practice-card__title">Your daily practice</p>
          <p className="practice-card__body">Pick up where you left off.</p>
        </div>
        {/* Forward-looking caption, per the ProgressBar's Figma notes: the
            filled part already carries what is done. */}
        <ProgressBar
          value={towardGoal}
          max={goal}
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
    <Shell length={`${sessionMinutes(goal)} min`}>
      <div className="practice-card__content">
        <p className="practice-card__title">Your daily practice</p>
        <p className="practice-card__body">
          {goal} word{goal === 1 ? " is" : "s are"} ready for you.
        </p>
      </div>
      <button className="btn btn--primary btn--inverted" onClick={onStart}>
        Start practice
      </button>
    </Shell>
  );
}

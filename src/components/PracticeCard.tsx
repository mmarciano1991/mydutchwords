/* PracticeCard — the dashboard's single entry point into today's Dutch
   (Figma 304:1118). Three states, all read from the day's GOAL rather than
   from a fixed-size set:

     ready    — nothing practised yet today: the cue, the size, one button
     progress — part of the goal done: an inverted ProgressBar, "Continue"
     done     — the goal is reached. The day is finished, and the card says
                so plainly. Extra practice is always offered, quietly, as an
                outlined button — never as the primary action, and never with
                any suggestion that tomorrow will ask for more.

   The old "caught up / practise ahead" and "add 16 words before you can
   practise" states are gone: the daily set always tops up from the whole
   deck, and the goal never exceeds the deck, so there is always a way to
   finish the day.

   Per the component's Figma documentation there is only ever one on the
   dashboard, and everything nested inside it uses the inverted/on-cobalt
   treatment. */
import type { ReactNode } from "react";
import { CardsStack } from "../icons";
import { ProgressBar } from "./ProgressBar";

export type PracticeCardStatus = "ready" | "progress" | "done";

/** Rough session length in whole minutes: about half a minute a card (a
 *  recall, not a read), rounded down so the promise is never overstated —
 *  10 words ≈ 5 min, 20 ≈ 10, 30 ≈ 15, matching the commitment options.
 *  Never zero. */
export function sessionMinutes(cardCount: number): number {
  return Math.max(1, Math.floor(cardCount / 2));
}

function Shell({ length, children }: { length: string | null; children: ReactNode }) {
  return (
    <section className="practice-card">
      <div className="practice-card__top">
        <CardsStack className="practice-card__icon" />
        <p className="practice-card__kind">Today&rsquo;s Dutch</p>
        {length && <p className="practice-card__length">{length}</p>}
      </div>
      {children}
    </section>
  );
}

export function PracticeCard({
  status,
  goal,
  towardGoal,
  extra,
  cue,
  tomorrow,
  canExtra,
  onStart,
  onExtra,
}: {
  status: PracticeCardStatus;
  /** Words that make today done. */
  goal: number;
  /** Of those, how many are done. */
  towardGoal: number;
  /** Practised past the goal today. */
  extra: number;
  /** "☀️ Your Dutch at 08:00" */
  cue: string;
  /** "at 08:00" — completes "See you tomorrow …". */
  tomorrow: string;
  /** Whether there is anything to practise at all (a non-empty deck). */
  canExtra: boolean;
  /** Starts, or continues, today's goal. */
  onStart: () => void;
  /** A few more words, past the goal. */
  onExtra: () => void;
}) {
  if (status === "done") {
    return (
      <Shell length="✓ Done">
        <div className="practice-card__content">
          <p className="practice-card__title">Done for today</p>
          <p className="practice-card__body">
            Today&rsquo;s {goal} word{goal === 1 ? "" : "s"} are done. See you tomorrow {tomorrow}.
          </p>
          {extra > 0 && <p className="practice-card__extra">+{extra} extra today</p>}
        </div>
        {canExtra && (
          <button className="btn btn--secondary btn--inverted" onClick={onExtra}>
            A few more, just for fun
          </button>
        )}
      </Shell>
    );
  }

  const left = goal - towardGoal;

  if (status === "progress") {
    return (
      <Shell length={`~${sessionMinutes(left)} min left`}>
        <div className="practice-card__content">
          <p className="practice-card__title">Almost there</p>
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
    <Shell length={`~${sessionMinutes(goal)} min`}>
      <div className="practice-card__content">
        <p className="practice-card__title">
          {goal} word{goal === 1 ? "" : "s"}
        </p>
        <p className="practice-card__body">{cue}</p>
      </div>
      <button className="btn btn--primary btn--inverted" onClick={onStart}>
        Start
      </button>
    </Shell>
  );
}

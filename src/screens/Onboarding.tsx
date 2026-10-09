/* Onboarding — the 2-minute promise.

   Four short screens, then straight into the first words — or, for a new
   user with no words yet, straight to adding the first one:

     1. Welcome      — the promise: small, daily, enough
     2. Commitment   — "How much Dutch fits your day?"
     3. Time         — "When will you do your Dutch?"
     4. Plan         — the choice read back as one sentence: "Every day at
                       08:00, I learn 5 Dutch words."

   Nothing else is asked. For someone who already has words, the last button
   starts the first session directly; for a new user it opens "Add a word"
   (there is no starter deck — words come only from what the user meets).

   Every choice is editable later in Settings, and the screens say so —
   picking the small option should never feel like locking oneself in. */
import { useState } from "react";
import { TulipMedallion } from "../components/brand";
import { CommitmentIcon } from "../components/CommitmentIcon";
import { IconButton } from "../components/IconButton";
import {
  COMMITMENTS,
  DEFAULT_HABIT_TIME,
  DEFAULT_WEEKLY_TARGET,
  commitmentOf,
  isHabitTime,
  planSentence,
  type Commitment,
  type HabitTime,
} from "../lib/habit";
import { Dock } from "../components/Dock";

type Step = "welcome" | "commitment" | "time" | "plan";
const STEPS: Step[] = ["welcome", "commitment", "time", "plan"];

export function Onboarding({
  existingUser,
  onComplete,
}: {
  /** Already has words or history: the welcome speaks to a change of rhythm,
   *  and no starter deck is added. */
  existingUser: boolean;
  onComplete: (choice: { commitment: Commitment; time: HabitTime }) => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [time, setTime] = useState<HabitTime>(DEFAULT_HABIT_TIME);
  // What the field shows, which may briefly be a half-typed (empty) time.
  const [timeInput, setTimeInput] = useState<string>(DEFAULT_HABIT_TIME);

  const index = STEPS.indexOf(step);
  const back = index > 0 ? () => setStep(STEPS[index - 1]) : undefined;

  return (
    <div className="screen pad-top onb">
      <div className="onb__top gutter">
        {back ? <IconButton action="back" onClick={back} aria-label="Back" /> : <span className="onb__spacer" />}
        <div className="onb__steps" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`onb__step${i <= index ? " is-on" : ""}`} />
          ))}
        </div>
        <span className="onb__spacer" />
      </div>

      {step === "welcome" && (
        <>
          <div className="screen__body center-col gutter onb__body onb__body--center">
            <TulipMedallion size={132} />
            <h1 className="display--lg onb__title">
              {existingUser ? "A gentler rhythm" : "A little Dutch, every day"}
            </h1>
            <p className="onb__lead">
              {existingUser
                ? "Woordkast now fits around your day. Pick a small daily amount — doing a little every day beats doing a lot once a week."
                : "Five minutes is enough. We’ll keep it small enough to fit into even your busiest day — that’s how it becomes a habit."}
            </p>
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" onClick={() => setStep("commitment")}>
              {existingUser ? "Set my rhythm" : "Let’s start"}
            </button>
          </Dock>
        </>
      )}

      {step === "commitment" && (
        <>
          <div className="screen__body gutter onb__body">
            <h1 className="title-serif onb__question">How much Dutch fits your day?</h1>
            <p className="onb__hint">There&rsquo;s no right answer. Pick what you could still do on a bad day.</p>
            <div className="choice-list" role="radiogroup" aria-label="Daily amount">
              {COMMITMENTS.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={commitment === c.id}
                  className={`choice${commitment === c.id ? " is-selected" : ""}`}
                  onClick={() => setCommitment(c.id)}
                >
                  <CommitmentIcon className="choice__icon" commitment={c.id} size={28} />
                  <span className="choice__text">
                    <span className="choice__title">{c.name}</span>
                    <span className="choice__sub">
                      {c.words} words · ~{c.minutes} min
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="onb__note">Consistency matters more than size. You can change this anytime.</p>
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" disabled={!commitment} onClick={() => setStep("time")}>
              Continue
            </button>
          </Dock>
        </>
      )}

      {step === "time" && (
        <>
          <div className="screen__body gutter onb__body">
            <h1 className="title-serif onb__question">When will you do your Dutch?</h1>
            <p className="onb__hint">
              Pick a time right after something you already do every day. It&rsquo;s a cue, not a rule — any time still counts.
            </p>
            <input
              type="time"
              className="time-field time-field--lg"
              aria-label="Daily time"
              value={timeInput}
              onChange={(e) => {
                setTimeInput(e.target.value);
                if (isHabitTime(e.target.value)) setTime(e.target.value);
              }}
            />
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" disabled={!isHabitTime(timeInput)} onClick={() => setStep("plan")}>
              Continue
            </button>
          </Dock>
        </>
      )}

      {step === "plan" && commitment && (
        <>
          <div className="screen__body center-col gutter onb__body onb__body--center">
            <p className="eyebrow">Your plan</p>
            <p className="onb__plan">{planSentence(commitment, time)}</p>
            <ul className="onb__facts">
              <li>Done means done — anything more is a bonus, never tomorrow&rsquo;s homework.</li>
              <li>Aim for {DEFAULT_WEEKLY_TARGET} days a week. Missing a day is normal.</li>
              {!existingUser && <li>Start with a Dutch word you met today — a sign, a letter, a colleague.</li>}
            </ul>
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" onClick={() => onComplete({ commitment, time })}>
              {existingUser ? `Start my first ${commitmentOf(commitment).words} words` : "Add my first word"}
            </button>
          </Dock>
        </>
      )}
    </div>
  );
}

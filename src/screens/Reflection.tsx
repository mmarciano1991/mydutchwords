/* Reflection — the monthly "then vs now" moment.

   Shown once every 30 days, right after the day's goal is reached — the
   moment the habit has just paid off. It names the actual words the learner
   didn't know a month ago, and shows a real letter with the words they can
   now read highlighted. No points, no badges: the reward is noticing that
   they have changed.

   It is a pause, not a gate — one button back to the day. */
import type { Reflection as ReflectionData } from "../lib/reflection";

const SHOWN_WORDS = 10;

export function Reflection({
  reflection,
  onDone,
}: {
  reflection: ReflectionData;
  onDone: () => void;
}) {
  const { learned, retained, text } = reflection;
  const shown = learned.slice(0, SHOWN_WORDS);
  const more = learned.length - shown.length;

  return (
    <div className="screen pad-top">
      <div className="screen__body gutter reflect">
        <p className="eyebrow">Then vs now</p>

        {learned.length > 0 && (
          <>
            <h1 className="title-serif reflect__title">30 days ago you didn&rsquo;t know these words.</h1>
            <p className="reflect__now">Now you do.</p>
            <ul className="reflect__words">
              {shown.map((w) => (
                <li key={w} className="reflect__word">{w}</li>
              ))}
              {more > 0 && <li className="reflect__word reflect__word--more">+{more} more</li>}
            </ul>
          </>
        )}

        {text && (
          <div className="reflect__text">
            <p className="reflect__text-lead">
              You can now read <strong>{text.now}%</strong> of the words in {text.name}
              <span className="reflect__then"> — a month ago it was {text.then}%.</span>
            </p>
            <p className="reflect__passage" aria-label={`Sample of ${text.name}`}>
              {text.tokens.map((t, i) =>
                t.knownNow ? (
                  <mark key={i} className="reflect__known">{t.text}</mark>
                ) : (
                  <span key={i}>{t.text}</span>
                )
              )}
            </p>
            <p className="reflect__legend">Highlighted: words you know now.</p>
          </div>
        )}

        {retained > 0 && (
          <p className="reflect__retained">
            And {retained} word{retained === 1 ? "" : "s"} you knew before {retained === 1 ? "is" : "are"} still with you.
          </p>
        )}

        <p className="reflect__close">That&rsquo;s what a few minutes a day does.</p>
      </div>

      <div className="gutter reflection-actions">
        <button className="btn btn--primary" onClick={onDone}>
          See you tomorrow
        </button>
      </div>
    </div>
  );
}

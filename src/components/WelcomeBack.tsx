/* WelcomeBack — the one thing a returning user sees after time away.

   Deliberately says nothing about the absence: no day count, no streak, no
   "you missed". It offers the smallest possible step — five words, two
   minutes — and one button that starts it. On a return day that warm-up IS
   the whole day's goal (see habit.todaysGoal), so finishing it finishes the
   day: the first thing a returning user experiences is success.

   "Not now" is there because a popup without a way out is a trap, not a
   welcome; it still counts as welcomed, so it never reappears that day. */
import { RETURN_WARMUP_WORDS } from "../lib/habit";

export function WelcomeBack({
  words,
  onStart,
  onDismiss,
}: {
  /** Warm-up size — RETURN_WARMUP_WORDS, or fewer for a tiny deck. */
  words: number;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const count = Math.min(words, RETURN_WARMUP_WORDS);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-back-title">
      <div className="modal__scrim" onClick={onDismiss} />
      <div className="modal__sheet">
        <p className="modal__emoji" aria-hidden="true">👋</p>
        <h2 id="welcome-back-title" className="title-serif modal__title">Welcome back</h2>
        <p className="modal__body">
          Your words waited for you.
          <br />
          {count} quick one{count === 1 ? "" : "s"} to warm up — 2 minutes.
        </p>
        <button className="btn btn--primary" onClick={onStart} autoFocus>
          Let&rsquo;s go
        </button>
        <button className="link-btn modal__later" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

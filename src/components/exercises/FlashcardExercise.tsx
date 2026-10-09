/* FlashcardExercise — the word, its article and its sentence; tap the card
   to see the translation.

   Answer by swiping the card or with the buttons below it: right is "I knew
   it", left is "Still learning" — the card goes toward the button it means.
   Press and the card lifts; drag and it leans, tints green or red and names
   the answer it's heading for. Let go past the threshold and the answer is
   taken: the card settles into its result (Figma
   "Flashcard-Success" / Flashcard error), holds it for a beat, then flies off
   that side. Let go short of it and it springs back with nothing answered.

   Exposure, never evidence: "I knew it" and "Still learning" are logged,
   and change nothing about the word's schedule (learningEngine, rule 4). */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { DictionaryEntry } from "../../lib/types";
import { Divider } from "../Divider";
import { GenderChip } from "../GenderChip";
import { Check, Close } from "../../icons";
import type { ExerciseCallbacks } from "./types";
import { Dock } from "../Dock";
import { usePronunciation } from "./usePronunciation";

type Verdict = "knew" | "learning";

/** Which way each answer swipes: toward its button. */
const SWIPE: Record<Verdict, 1 | -1> = { knew: 1, learning: -1 };
const LABEL: Record<Verdict, string> = { knew: "I knew it", learning: "Still learning" };

/** How far the card must travel before letting go answers it. */
const COMMIT_PX = 96;
/** Movement below this is still a tap (flip), not a drag. */
const TAP_SLOP_PX = 6;
/** Past this the card starts to lean toward an answer. */
const LEAN_PX = 16;
/** How long the result pose is held before the card flies off. */
const RESULT_HOLD_MS = 520;
/** How long the card takes to fly off — matches --motion-swipe. */
const FLY_OUT_MS = 320;
/** From an answer to the next exercise. */
export const ANSWER_MS = RESULT_HOLD_MS + FLY_OUT_MS;
/** The result pose for each answer (Figma: ~10° right in green, ~15° left in red). */
const RESULT_POSE: Record<Verdict, { x: number; rotate: number }> = {
  knew: { x: 104, rotate: 10 },
  learning: { x: -88, rotate: -15 },
};

const verdictOf = (dx: number): Verdict => (Math.sign(dx) === SWIPE.knew ? "knew" : "learning");

export function FlashcardExercise({ entry, onResult, onNext }: { entry: DictionaryEntry } & ExerciseCallbacks) {
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Set synchronously: two events in one frame can't both answer.
  const answered = useRef(false);
  const gesture = useRef<{ id: number; x0: number; y0: number; moved: boolean } | null>(null);
  // A drag ends in a click on the card; that click must not also flip it.
  const swallowClick = useRef(false);
  const timers = useRef<number[]>([]);
  const helpId = useId();

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  // The card's face is the Dutch word: say it as the card comes in.
  usePronunciation(entry.dutch);

  function answer(v: Verdict) {
    if (answered.current) return;
    answered.current = true;
    setVerdict(v);
    setPressed(false);
    setDrag((d) => ({ ...d, active: false }));
    onResult(entry.id, "exposure");
    timers.current.push(
      window.setTimeout(() => setLeaving(true), RESULT_HOLD_MS),
      window.setTimeout(() => onNext(v === "knew"), ANSWER_MS)
    );
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (answered.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    setPressed(true);
    // A touch drag ends without a click, so a stale "swallow" must not eat this press's tap.
    swallowClick.current = false;
    // Captured from the press on, so the release lands here wherever it happens.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const x = e.clientX - g.x0;
    const y = e.clientY - g.y0;
    if (!g.moved) {
      if (Math.hypot(x, y) < TAP_SLOP_PX) return;
      g.moved = true;
    }
    setDrag({ x, y, active: true });
  }

  function release(e: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    setPressed(false);
    if (!g.moved) return;
    swallowClick.current = true;
    // Only how far the card was taken decides: short of the threshold, nothing is answered.
    const x = e.clientX - g.x0;
    if (!cancelled && Math.abs(x) > COMMIT_PX) {
      answer(verdictOf(x));
    } else {
      setDrag({ x: 0, y: 0, active: false });
    }
  }

  function onClick() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    if (!answered.current) setFlipped((f) => !f);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      answer(verdictOf(e.key === "ArrowRight" ? 1 : -1));
    }
  }

  const lean: Verdict | null = verdict ?? (Math.abs(drag.x) > LEAN_PX ? verdictOf(drag.x) : null);
  const progress = verdict ? 1 : Math.min(1, Math.abs(drag.x) / COMMIT_PX);
  const armed = (v: Verdict) => lean === v && progress >= 1;

  // Lifted while held; leaning with the finger; then the result pose, then off.
  let transform: string | undefined;
  if (verdict) {
    const pose = RESULT_POSE[verdict];
    transform = leaving
      ? `translate3d(${SWIPE[verdict] * 560}px, 48px, 0) rotate(${pose.rotate * 2.4}deg)`
      : `translate3d(${pose.x}px, 0, 0) rotate(${pose.rotate}deg)`;
  } else if (drag.x || drag.y) {
    const tilt = Math.max(-18, Math.min(18, drag.x / 10));
    transform = `translate3d(${drag.x}px, ${drag.y * 0.35}px, 0) rotate(${tilt}deg) scale(1.03)`;
  } else if (pressed) {
    transform = "scale(1.03)";
  }

  const swipeClass = [
    "flashcard__swipe",
    drag.active ? "is-dragging" : "",
    verdict && !leaving ? "is-result" : "",
    leaving ? "is-leaving" : "",
    lean ? `flashcard--${lean}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hint = (
    <div
      key={lean ?? "flip"}
      className={`flashcard__hint${lean ? " flashcard__hint--verdict" : ""}`}
      aria-hidden="true"
    >
      {lean ? LABEL[lean] : "Tap to flip"}
    </div>
  );

  return (
    <>
      <div className="screen__body gutter exercise exercise--flashcard">
        <button
          className="flashcard"
          onClick={onClick}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => release(e, false)}
          onPointerCancel={(e) => release(e, true)}
          aria-describedby={helpId}
        >
          <div className={swipeClass} style={{ transform, "--swipe": progress } as CSSProperties}>
            <div className={`flashcard__inner${flipped ? " is-flipped" : ""}`}>
              {/* No aria-label on the button itself: an explicit label would
                  replace this whole subtree as the accessible name, which is
                  exactly what made the card silent to a screen reader (see
                  docs/pilot-readiness-report.md, C1). The button's name now
                  composes from whichever face is actually showing. Both faces
                  stay in the DOM at all times (the 3D flip needs that), so
                  each face's aria-hidden is toggled by `flipped` explicitly —
                  without it, the not-currently-showing face's text risks
                  being included in the accessible name too, which would read
                  the translation and the word out together and give the
                  answer away before it's earned. */}
              <div className="flashcard__face flashcard__face--front" aria-hidden={flipped}>
                <GenderChip gender={entry.gender} />
                <div className="flashcard__word">{entry.dutch}</div>
                {entry.example && <Divider />}
                {entry.example && <div className="flashcard__example">{entry.example}</div>}
                {hint}
              </div>
              <div className="flashcard__face flashcard__face--back" aria-hidden={!flipped}>
                <GenderChip gender={entry.gender} />
                <div className="flashcard__word">{entry.english}</div>
                {entry.exampleEn && <Divider />}
                {entry.exampleEn && <div className="flashcard__example">{entry.exampleEn}</div>}
                {hint}
              </div>
            </div>
          </div>
        </button>
        <p id={helpId} className="sr-only">
          Tap to flip. Swipe right, or press the right arrow, if you knew it; left if you are still learning it.
        </p>
      </div>

      {/* Rating is offered on both faces. Recall happens before the flip —
          you either had the word or you didn't — so a learner who knows it
          can answer straight away instead of flipping to a translation they
          didn't need. The card itself stays the only reveal affordance. */}
      <Dock className="gutter exercise__rate">
        <button
          className={`btn btn--difficult${armed("learning") ? " is-armed" : ""}`}
          onClick={() => answer("learning")}
          aria-disabled={verdict !== null}
        >
          <Close size={24} />
          Still learning
        </button>
        <button
          className={`btn btn--success${armed("knew") ? " is-armed" : ""}`}
          onClick={() => answer("knew")}
          aria-disabled={verdict !== null}
        >
          <Check size={24} />
          I knew it
        </button>
      </Dock>
    </>
  );
}

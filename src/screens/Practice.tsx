import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { DictionaryEntry } from "../lib/types";
import { applyGrade, type Grade, type ReviewedCard, type Word } from "../lib/learningEngine";
import {
  advanceQueue,
  buildChoices,
  checkTyped,
  initialQueue,
  pickExercise,
  synonymsOf,
  type ExerciseKind,
  type TypedVerdict,
} from "../lib/exercises";
import { GenderChip } from "../components/GenderChip";
import { IconButton } from "../components/IconButton";
import { Divider } from "../components/Divider";
import { Notice } from "../components/Notice";
import { ArrowUpward, Check, Close } from "../icons";

export interface PracticeCard {
  entry: DictionaryEntry;
  word: Word;
}

/** How long a correct answer stays on screen before the next exercise —
 *  long enough to register the green, short enough not to wait for. */
export const ADVANCE_AFTER_CORRECT_MS = 900;

type Feedback =
  | { kind: "choice"; picked: string; correct: boolean }
  | { kind: "typing"; typed: string; verdict: TypedVerdict | "skipped" };

/** "het huis" for a noun, the bare word otherwise — how an answer is shown. */
function withArticle(entry: DictionaryEntry): string {
  return entry.gender === "de" || entry.gender === "het" ? `${entry.gender} ${entry.dutch}` : entry.dutch;
}

/* Practice — one sitting through a set of words.

   The sitting is a queue (lib/exercises): each word is asked as a multiple
   choice, a typed translation or a flashcard, depending on how well it is
   known. A correct answer takes the word out of the queue; a miss or a skip
   puts it back a few words later, so the sitting only ends once every word
   in it has been got right.

   Only the FIRST answer to a word goes onto the ladder and into the run's
   answers. A retry minutes after seeing the answer is practice, not
   evidence of knowing it: grading it too would move a word up the ladder on
   the strength of a reminder. The retry only clears the word (onCleared). */
export function Practice({
  queue,
  pool = [],
  scheduling = true,
  alreadyGraded,
  onAnswer,
  onCleared,
  onGrade,
  onFinish,
  onClose,
}: {
  queue: PracticeCard[];
  /** Words to draw multiple-choice options from (the deck). */
  pool?: DictionaryEntry[];
  /** false = warm-up (ahead-of-schedule): answers are not graded into the ladder. */
  scheduling?: boolean;
  /** Words whose ladder grade for today has already been given — carried
   *  over from a sitting that was left with them still missed. Asked, but
   *  not graded a second time. */
  alreadyGraded?: ReadonlySet<string>;
  /** Fired for each word's FIRST answer in the sitting, warm-up included, as
   *  it is given. This is what the practice run records, and so what the
   *  dashboard's card reports — a warm-up that goes badly has to be visible
   *  as such, even though it deliberately leaves the schedule alone. */
  onAnswer?: (wordId: string, grade: Grade) => void;
  /** Fired when a word is answered correctly — first try or a later retry.
   *  Only then is the word done. */
  onCleared?: (wordId: string) => void;
  /** Fired for every first answer that is graded onto the ladder. Not called
   *  in warm-up: those answers deliberately don't move the schedule. */
  onGrade?: (card: ReviewedCard) => void;
  onFinish: (reviewedCards: ReviewedCard[]) => void;
  onClose: () => void;
}) {
  const cards = useMemo(() => new Map(queue.map((c) => [c.word.id, c])), [queue]);
  const [pending, setPending] = useState(() => initialQueue(queue.map((c) => c.word.id)));
  // Bumped per exercise: re-keys the body (its entry animation, a fresh
  // input) and re-draws the options.
  const [step, setStep] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Snapshot at mount: grades given during this sitting are tracked below.
  const [skipLadder] = useState(() => new Set(alreadyGraded ?? []));
  const attempted = useRef(new Set<string>());
  const reviewed = useRef<ReviewedCard[]>([]);
  const continueRef = useRef<HTMLButtonElement>(null);

  const item = pending[0];
  const { entry, word } = cards.get(item.id)!;

  // Drawn once per exercise, so the options don't reshuffle under a finger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const choices = useMemo(() => buildChoices(entry, pool), [step]);
  const kind: ExerciseKind = pickExercise(word, item, choices !== null);
  const retry = item.attempts > 0;

  /** Records an answer the moment it is given. The session can end in ways
   *  that never reach onFinish — the close button, a backgrounded tab the OS
   *  reclaims — and an answer the user gave is not the app's to lose. */
  function settle(correct: boolean) {
    const id = word.id;
    if (!attempted.current.has(id)) {
      attempted.current.add(id);
      const g: Grade = correct ? "know" : "dontKnow";
      const ladder = scheduling && !skipLadder.has(id);
      const updated = ladder ? applyGrade(word, g, new Date()) : word;
      onAnswer?.(id, g);
      if (ladder) onGrade?.({ word: updated, grade: g });
      reviewed.current.push({ word: updated, grade: g });
    }
    if (correct) {
      onCleared?.(id);
      setCleared((n) => n + 1);
    }
  }

  /** On to the next exercise — or, with the queue empty, the report. */
  function advance(correct: boolean) {
    const rest = advanceQueue(pending, correct, kind);
    if (rest.length === 0) {
      onFinish(reviewed.current);
      return;
    }
    setPending(rest);
    setStep((s) => s + 1);
    setFlipped(false);
    setTyped("");
    setFeedback(null);
  }

  const correctShown =
    feedback !== null &&
    (feedback.kind === "choice" ? feedback.correct : feedback.verdict === "correct" || feedback.verdict === "typo");

  // A right answer moves on by itself; a wrong one waits for Continue, so
  // the correct answer can actually be read.
  useEffect(() => {
    if (!correctShown) {
      if (feedback) continueRef.current?.focus();
      return;
    }
    const t = window.setTimeout(() => advance(true), ADVANCE_AFTER_CORRECT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  function gradeFlashcard(g: Grade) {
    settle(g === "know");
    advance(g === "know");
  }

  function pick(option: string) {
    if (feedback) return;
    const correct = option === entry.dutch;
    settle(correct);
    setFeedback({ kind: "choice", picked: option, correct });
  }

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    if (feedback || !typed.trim()) return;
    const verdict = checkTyped(typed, entry.dutch, synonymsOf(entry, pool));
    settle(verdict !== "wrong");
    setFeedback({ kind: "typing", typed, verdict });
  }

  function skipTyped() {
    if (feedback) return;
    settle(false);
    setFeedback({ kind: "typing", typed: "", verdict: "skipped" });
  }

  const total = queue.length;
  const progress = (cleared / total) * 100;
  const waiting = feedback !== null && !correctShown;

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <IconButton action="close" onClick={onClose} aria-label="Close practice" />
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={cleared}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={`${cleared} of ${total} words done`}
        >
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
          {cleared}/{total}
        </span>
      </div>

      {!scheduling && <p className="exercise__note">Warm-up — does not change your schedule</p>}

      {kind === "flashcard" ? (
        <>
          <div
            key={step}
            className="screen__body gutter exercise"
            style={{ padding: "14px 22px 4px", display: "flex", flexDirection: "column" }}
          >
            <div className="eyebrow" style={{ textAlign: "center" }}>
              {flipped ? "Translation" : retry ? "Back again — do you know it now?" : "Do you know this word?"}
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
                    being included in the accessible name too, which would read
                    the translation and the word out together and give the
                    answer away before it's earned. */}
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

          {/* Grading is offered on both faces. Recall happens before the flip —
              you either had the word or you didn't — so a learner who knows it
              can answer straight away instead of flipping to a translation they
              didn't need. The card itself stays the only reveal affordance. */}
          <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", gap: 12 }}>
            <button className="btn btn--difficult" onClick={() => gradeFlashcard("dontKnow")}>
              <Close size={16} />
              Still learning
            </button>
            <button className="btn btn--success" onClick={() => gradeFlashcard("know")}>
              <Check size={16} />
              I knew it
            </button>
          </div>
        </>
      ) : (
        <>
          <div key={step} className="screen__body gutter exercise">
            <p className="eyebrow exercise__eyebrow">
              {retry ? "Back again — one more try" : "Translate into Dutch"}
            </p>

            <div className="exercise__prompt">
              <p className="exercise__word" lang="en">
                {entry.english}
              </p>
              {entry.exampleEn && <Divider />}
              {entry.exampleEn && (
                <p className="exercise__example" lang="en">
                  {entry.exampleEn}
                </p>
              )}
            </div>

            {kind === "choice" && choices && (
              <>
                <p
                  className={`exercise__verdict${
                    feedback ? (correctShown ? " exercise__verdict--right" : " exercise__verdict--wrong") : ""
                  }`}
                  role="status"
                >
                  {!feedback
                    ? "Choose the right answer"
                    : correctShown
                      ? "Correct!"
                      : "No problem — it’ll come back in a moment."}
                </p>
                <div className="answer-options" role="group" aria-label="Answer options">
                  {choices.map((option) => {
                    const isAnswer = option === entry.dutch;
                    const isPicked = feedback?.kind === "choice" && feedback.picked === option;
                    const state = !feedback
                      ? ""
                      : isPicked
                        ? isAnswer
                          ? " is-right"
                          : " is-wrong"
                        : isAnswer
                          ? " is-answer"
                          : " is-dim";
                    return (
                      <button
                        key={option}
                        type="button"
                        lang="nl"
                        className={`answer-option${state}`}
                        onClick={() => pick(option)}
                        aria-disabled={feedback !== null}
                      >
                        {feedback && (isPicked || isAnswer) && (
                          <span className="answer-option__icon">{isAnswer ? <Check size={22} /> : <Close size={22} />}</span>
                        )}
                        <span>{option}</span>
                        {feedback && isAnswer && !isPicked && <span className="sr-only"> — correct answer</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {kind === "typing" && feedback?.kind === "typing" && (
              <div className="exercise__feedback">
                {feedback.verdict === "correct" && <Notice type="success">Correct!</Notice>}
                {feedback.verdict === "typo" && (
                  <Notice type="success">
                    Almost — it’s spelled <span lang="nl">{withArticle(entry)}</span>
                  </Notice>
                )}
                {feedback.verdict === "wrong" && (
                  <Notice type="error">
                    Not quite — it’s <span lang="nl">{withArticle(entry)}</span>
                  </Notice>
                )}
                {feedback.verdict === "skipped" && (
                  <Notice type="info">
                    It’s <span lang="nl">{withArticle(entry)}</span> — it’ll come back in a moment.
                  </Notice>
                )}
                {feedback.verdict === "wrong" && (
                  <p className="exercise__yours">
                    You wrote <span lang="nl">{feedback.typed.trim()}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="gutter exercise__actions">
            {waiting ? (
              <button ref={continueRef} className="btn btn--primary" onClick={() => advance(false)}>
                Continue
              </button>
            ) : (
              kind === "typing" && (
                <form className={`answer-bar${feedback ? " is-locked" : ""}`} onSubmit={submitTyped}>
                  <input
                    className="answer-bar__input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Type the Dutch word"
                    aria-label={`Dutch for “${entry.english}”`}
                    lang="nl"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    readOnly={feedback !== null}
                  />
                  <button type="button" className="answer-bar__skip" onClick={skipTyped} disabled={feedback !== null}>
                    Don’t know
                  </button>
                  <button
                    type="submit"
                    className="answer-bar__submit"
                    aria-label="Check answer"
                    disabled={!typed.trim() || feedback !== null}
                  >
                    <ArrowUpward size={20} />
                  </button>
                </form>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* AnswerPanel — the bottom of every graded exercise (Figma "Answer",
   Practice session board). One slot, three states:

     pending  Check (disabled until there is something to check) and a
              text action beneath it — "I do not know", or Listening's skip.
     correct  green: "Correct" (or a softer note, e.g. a spelling fix), the
              word in its sentence, and Continue.
     wrong    red: "Not quite, the answer is …", the sentence, and Got it.

   Every graded answer ends on the word in its context sentence, so the
   sentence lives here, under the verdict.

   It's a Dock: pinned to the bottom of the screen and floating over the
   body, which keeps room to scroll clear of it. While answering it sits on
   the dock's fade-and-blur; a verdict fills it with its solid colour. */
import { useEffect, useRef, type ReactNode } from "react";
import type { ContextSentence as Context } from "../../lib/sentenceTarget";
import type { DictionaryEntry } from "../../lib/types";
import { Cancel, CheckCircle } from "../../icons";
import { ContextSentence } from "./ContextSentence";
import { Dock } from "../Dock";

export type AnswerPanelProps =
  | {
      verdict: null;
      /** Check is live once something is picked or typed. */
      canCheck: boolean;
      /** A typed answer submits its own form: Check is that form's submit. */
      form?: string;
      onCheck?: () => void;
      /** Matching checks each pair as it's made, so it has no Check. */
      noCheck?: boolean;
      skipLabel?: string;
      onSkip?: () => void;
    }
  | {
      verdict: "correct" | "wrong";
      /** Replaces "Correct" / "Not quite, the answer is …" when there's more to say. */
      message: ReactNode;
      entry?: DictionaryEntry;
      context?: Context | null;
      /** A closing line under the sentence — when a missed word comes back. */
      note?: string;
      onContinue: () => void;
    };

export function AnswerPanel(props: AnswerPanelProps) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const verdict = props.verdict;

  // Keyboard and screen-reader users land on the way forward.
  useEffect(() => {
    if (verdict) continueRef.current?.focus();
  }, [verdict]);

  if (props.verdict === null) {
    return (
      <Dock className="answer-panel">
        {!props.noCheck && (
          <button
            type={props.form ? "submit" : "button"}
            form={props.form}
            className="btn btn--primary"
            disabled={!props.canCheck}
            onClick={props.form ? undefined : props.onCheck}
          >
            Check
          </button>
        )}
        {props.skipLabel && (
          <button type="button" className="answer-panel__link" onClick={props.onSkip}>
            {props.skipLabel}
          </button>
        )}
      </Dock>
    );
  }

  const right = props.verdict === "correct";

  return (
    <Dock className={`answer-panel answer-panel--${props.verdict}`}>
      <div className="answer-panel__feedback" role="status">
        <p className="answer-panel__title">
          {right ? <CheckCircle size={24} aria-hidden="true" /> : <Cancel size={24} aria-hidden="true" />}
          <span>{props.message}</span>
        </p>
        {props.entry && <ContextSentence entry={props.entry} context={props.context} />}
        {props.note && <p className="answer-panel__note">{props.note}</p>}
      </div>
      <button ref={continueRef} type="button" className="btn answer-panel__continue" onClick={props.onContinue}>
        {right ? "Continue" : "Got it"}
      </button>
    </Dock>
  );
}

/** "Not quite, the answer is huis" — the wrong-answer title. */
export function notQuite(answer: string, lang: "nl" | "en" = "nl"): ReactNode {
  return (
    <>
      Not quite, <span className="answer-panel__soft">the answer is</span> <span lang={lang}>{answer}</span>
    </>
  );
}

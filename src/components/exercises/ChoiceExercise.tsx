/* ChoiceExercise — pick the right option. Two kinds, one layout:

     multiple_choice  the Dutch word is shown; choose its English
                      translation from four.
     listening        the word is spoken; choose the written Dutch word
                      that was heard from four. "I can’t listen now" skips it
                      without counting for or against the word.

   Tap an option to select it, then Check (Figma "Practice session": Default →
   Select → Success / Error). The verdict and the word in its sentence show in
   the answer panel; a miss marks the right option too, and the session moves
   on. */
import { useState } from "react";
import { speakDutch } from "../../lib/audio";
import type { DictionaryEntry } from "../../lib/types";
import { GenderChip } from "../GenderChip";
import { BrandAwareness, Cancel, CheckCircle } from "../../icons";
import type { ExerciseCallbacks } from "./types";
import { AnswerPanel, notQuite } from "./AnswerPanel";
import { usePronunciation } from "./usePronunciation";

type Outcome = { kind: "checked"; option: string } | { kind: "dont_know" };

export function ChoiceExercise({
  kind,
  entry,
  options,
  onResult,
  onNext,
  comesBack,
}: {
  kind: "multiple_choice" | "listening";
  entry: DictionaryEntry;
  options: string[];
} & ExerciseCallbacks) {
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const listening = kind === "listening";
  const answer = listening ? entry.dutch : entry.english;
  const correct = outcome?.kind === "checked" && outcome.option === answer;

  // Both say the Dutch word as they appear: Listening asks about it,
  // Multiple Choice shows it.
  usePronunciation(entry.dutch);

  function check() {
    if (outcome || selected === null) return;
    setOutcome({ kind: "checked", option: selected });
    onResult(entry.id, selected === answer ? "correct" : "wrong");
  }

  function dontKnow() {
    if (outcome) return;
    setOutcome({ kind: "dont_know" });
    onResult(entry.id, "dont_know");
  }

  function skip() {
    onResult(entry.id, "skipped");
    onNext(true);
  }

  function stateOf(option: string): string {
    if (!outcome) return option === selected ? " is-selected" : "";
    const isAnswer = option === answer;
    if (outcome.kind === "checked" && option === outcome.option) return isAnswer ? " is-right" : " is-wrong";
    return isAnswer ? " is-answer" : "";
  }

  return (
    <>
      <div className={`screen__body gutter exercise exercise--choice${listening ? " exercise--listening" : ""}`}>
        <div className="exercise__prompt">
          {listening ? (
            <button type="button" className="listen-button" onClick={() => speakDutch(entry.dutch)}>
              <BrandAwareness size={24} />
              <span>Play again</span>
            </button>
          ) : (
            <>
              <GenderChip gender={entry.gender} />
              <p className="exercise__word" lang="nl">
                {entry.dutch}
              </p>
            </>
          )}
        </div>

        <div className="exercise__group">
          <p className="exercise__verdict">{listening ? "Which word did you hear?" : "Choose the translation"}</p>

          <div className="answer-options" role="group" aria-label="Answer options">
            {options.map((option) => {
              const state = stateOf(option);
              const marked = state === " is-right" || state === " is-answer" || state === " is-wrong";
              return (
                <button
                  key={option}
                  type="button"
                  lang={listening ? "nl" : "en"}
                  className={`answer-option${state}`}
                  onClick={() => !outcome && setSelected(option)}
                  aria-pressed={!outcome ? option === selected : undefined}
                  aria-disabled={outcome !== null}
                >
                  <span className="answer-option__label">{option}</span>
                  {marked && (
                    <span className="answer-option__icon" aria-hidden="true">
                      {state === " is-wrong" ? <Cancel size={24} /> : <CheckCircle size={24} />}
                    </span>
                  )}
                  {state === " is-answer" && <span className="sr-only"> — correct answer</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {outcome ? (
        <AnswerPanel
          verdict={correct ? "correct" : "wrong"}
          message={correct ? "Correct" : notQuite(answer, listening ? "nl" : "en")}
          entry={entry}
          note={correct ? undefined : comesBack}
          onContinue={() => onNext(correct)}
        />
      ) : (
        <AnswerPanel
          verdict={null}
          canCheck={selected !== null}
          onCheck={check}
          skipLabel={listening ? "I can’t listen now" : "I do not know"}
          onSkip={listening ? skip : dontKnow}
        />
      )}
    </>
  );
}

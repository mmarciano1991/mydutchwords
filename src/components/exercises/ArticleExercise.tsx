/* ArticleExercise — de or het? Shown for a noun whose article is verified
   and single (lib/exerciseData): a word with both (de/het filter) or an
   unverified article never gets it.

   Tap de or het, then Check. The verdict and the word in its sentence show
   in the answer panel. */
import { useState } from "react";
import type { DictionaryEntry } from "../../lib/types";
import { Cancel, CheckCircle } from "../../icons";
import type { ExerciseCallbacks } from "./types";
import { AnswerPanel, notQuite } from "./AnswerPanel";
import { usePronunciation } from "./usePronunciation";
import { speakDutch } from "../../lib/audio";
import { SOUND_MS } from "../../lib/sfx";

const OPTIONS = ["de", "het"] as const;

export function ArticleExercise({ entry, onResult, onNext, comesBack }: { entry: DictionaryEntry } & ExerciseCallbacks) {
  const [selected, setSelected] = useState<"de" | "het" | null>(null);
  const [outcome, setOutcome] = useState<{ kind: "checked"; option: "de" | "het" } | { kind: "dont_know" } | null>(null);
  const answer = entry.snapshot?.article === "het" ? "het" : "de";
  const correct = outcome?.kind === "checked" && outcome.option === answer;
  usePronunciation(entry.dutch);

  function check() {
    if (outcome || !selected) return;
    setOutcome({ kind: "checked", option: selected });
    onResult(entry.id, selected === answer ? "correct" : "wrong");
    // The answer, said with its article once the verdict sound has played.
    speakDutch(`${answer} ${entry.dutch}`, { delayMs: SOUND_MS[selected === answer ? "correct" : "wrong"] });
  }

  return (
    <>
      <div className="screen__body gutter exercise exercise--choice exercise--article">
        <div className="exercise__prompt">
          <p className="exercise__word" lang="nl">
            {entry.dutch}
          </p>
          <p className="exercise__example" lang="en">
            {entry.english}
          </p>
        </div>
        <div className="exercise__group">
          <p className="exercise__verdict">Which article does it take?</p>
          <div className="answer-options answer-options--pair" role="group" aria-label="de or het">
            {OPTIONS.map((option) => {
              const state = !outcome
                ? option === selected
                  ? " is-selected"
                  : ""
                : outcome.kind === "checked" && option === outcome.option
                  ? option === answer
                    ? " is-right"
                    : " is-wrong"
                  : option === answer
                    ? " is-answer"
                    : "";
              return (
                <button
                  key={option}
                  type="button"
                  lang="nl"
                  className={`answer-option${state}`}
                  onClick={() => !outcome && setSelected(option)}
                  aria-pressed={!outcome ? option === selected : undefined}
                  aria-disabled={outcome !== null}
                >
                  <span className="answer-option__label">{option}</span>
                  {(state === " is-right" || state === " is-wrong" || state === " is-answer") && (
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
          message={correct ? "Correct" : notQuite(`${answer} ${entry.dutch}`)}
          entry={entry}
          note={correct ? undefined : comesBack}
          onContinue={() => onNext(correct)}
        />
      ) : (
        <AnswerPanel
          verdict={null}
          canCheck={selected !== null}
          onCheck={check}
          skipLabel="I do not know"
          onSkip={() => {
            if (outcome) return;
            setOutcome({ kind: "dont_know" });
            onResult(entry.id, "dont_know");
            speakDutch(`${answer} ${entry.dutch}`);
          }}
        />
      )}
    </>
  );
}

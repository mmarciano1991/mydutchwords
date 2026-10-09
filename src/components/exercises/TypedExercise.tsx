/* TypedExercise — produce the Dutch word. Two kinds, one answer field:

     active_recall        the English translation, with a part-of-speech
                          hint (and the article for a noun); type the Dutch.
     sentence_completion  the context sentence with the word blanked, and
                          its English below; type the word in the exact form
                          the sentence needs ("doet", not "doen").

   Type, then Check in the answer panel (Figma "Practice session"); "I do not
   know" reveals the answer — an honest failed retrieval. Answers are graded
   by lib/answerCheck, and the verdict and the word in its context sentence
   show in the panel while the field keeps what was typed. */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { checkAnswer, type AnswerCheck } from "../../lib/answerCheck";
import { posHint } from "../../lib/exercises";
import type { ReviewResult } from "../../lib/learningEngine";
import type {
  ContextSentence as Context,
  TargetForm,
} from "../../lib/sentenceTarget";
import type { DictionaryEntry } from "../../lib/types";
import { GenderChip } from "../GenderChip";
import { withArticle, type ExerciseCallbacks } from "./types";
import { speakDutch } from "../../lib/audio";
import { SOUND_MS } from "../../lib/sfx";
import { usePronunciation } from "./usePronunciation";
import { AnswerPanel, notQuite } from "./AnswerPanel";

type Outcome =
  | { kind: "checked"; typed: string; check: AnswerCheck }
  | { kind: "dont_know" };

export function TypedExercise({
  kind,
  entry,
  completion,
  synonyms = [],
  isKnownWord,
  onResult,
  onNext,
  comesBack,
}: {
  kind: "active_recall" | "sentence_completion";
  entry: DictionaryEntry;
  /** Sentence Completion: the sentence, and where the word sits in it. */
  completion?: Context & { target: TargetForm };
  /** Other deck words with the same meaning — just as right (Active Recall). */
  synonyms?: string[];
  /** True for a real Dutch word — a typed one is never a "typo" of another. */
  isKnownWord?: (word: string) => boolean;
} & ExerciseCallbacks) {
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const formId = useId();
  const sentence = kind === "sentence_completion" ? completion : undefined;
  const article =
    entry.gender === "de" || entry.gender === "het" ? entry.gender : null;
  // What's shown as the right answer: the sentence's form, or the word with its article.
  const shown = sentence ? sentence.target.form : withArticle(entry);
  // Nothing said up front — the word is the answer. Said once it's shown.
  usePronunciation(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (outcome || !typed.trim()) return;
    const check = checkAnswer(
      typed,
      sentence
        ? {
            answer: sentence.target.form,
            dictionaryForm: entry.dutch,
            isOtherWord: isKnownWord,
          }
        : {
            answer: entry.dutch,
            article,
            alternatives: synonyms,
            isOtherWord: isKnownWord,
          },
    );
    const result: ReviewResult = check.verdict;
    onResult(entry.id, result);
    setOutcome({ kind: "checked", typed, check });
    // The answer, said once its verdict sound has played.
    speakDutch(shown, { delayMs: SOUND_MS[result === "wrong" ? "wrong" : "correct"] });
  }

  function dontKnow() {
    if (outcome) return;
    onResult(entry.id, "dont_know");
    setOutcome({ kind: "dont_know" });
    speakDutch(shown);
  }

  const passed =
    outcome?.kind === "checked" && outcome.check.verdict !== "wrong";
  const right = <strong lang="nl">{shown}</strong>;
  const after = sentence ? sentence.sentence.slice(sentence.target.end) : "";
  const trailing = after.match(/^[.,!?;:…»”’)]+/)?.[0] ?? "";

  // The panel's title: plain "Correct", or what's worth knowing about the answer.
  let message: ReactNode = null;
  if (outcome?.kind === "dont_know") {
    message = (
      <>
        <span className="answer-panel__soft">The answer is</span> {right}
      </>
    );
  } else if (outcome?.kind === "checked") {
    const { check } = outcome;
    if (check.verdict === "wrong") message = notQuite(shown);
    else if (check.dictionaryForm) message = <>Right word — in this sentence it’s {right}</>;
    else if (check.showSpelling) message = <>Almost — it’s spelled {right}</>;
    else if (check.rightArticle)
      message = (
        <>
          Correct — it’s <strong lang="nl">{`${check.rightArticle} ${entry.dutch}`}</strong>
        </>
      );
    else message = check.verdict === "almost" ? "Almost" : "Correct";
  }

  return (
    <>
      <div className="screen__body gutter exercise exercise--typed">
        <div className="exercise__prompt">
          {sentence ? (
            <>
              <p className="exercise__sentence" lang="nl">
                {sentence.sentence.slice(0, sentence.target.start)}
                {/* The gap and any punctuation right after it stay on one
                    line, so a full stop never wraps away on its own. */}
                <span className="exercise__gap-line">
                  {/* The gap mirrors what's typed in the field below. */}
                  <span
                    className={`exercise__gap${typed ? " is-filled" : ""}${
                      outcome ? (passed ? " is-right" : " is-wrong") : ""
                    }`}
                    style={{
                      minWidth: `${Math.max(4, sentence.target.form.length) + 1}ch`,
                    }}
                    aria-hidden="true"
                  >
                    {typed.trim() || "\u00a0"}
                  </span>
                  {trailing}
                </span>
                {after.slice(trailing.length)}
              </p>
              {/* A captured sentence has no translation (Q8): the word's
                  meaning stands in for it. */}
              <p className="exercise__example" lang="en">
                {sentence.translation ??
                  `The missing word means “${entry.english}”.`}
              </p>
            </>
          ) : (
            <>
              {/* A noun shows the article its Dutch answer takes; any other
                  word keeps its part-of-speech hint. */}
              {article ? (
                <GenderChip gender={entry.gender} />
              ) : (
                posHint(entry) && <p className="exercise__hint">{posHint(entry)}</p>
              )}
              <p className="exercise__word" lang="en">
                {entry.english}
              </p>
            </>
          )}
        </div>

        <form id={formId} className="exercise__form" onSubmit={submit}>
          <div className="answer-bar">
            <input
              className="answer-bar__input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              readOnly={outcome !== null}
              placeholder={sentence ? "Fill in the missing word" : "Type the Dutch word"}
              aria-label={sentence ? "The missing Dutch word" : `Dutch for “${entry.english}”`}
              lang="nl"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        </form>
      </div>

      {outcome ? (
        <AnswerPanel
          verdict={passed ? "correct" : "wrong"}
          message={message}
          entry={entry}
          context={sentence}
          note={passed ? undefined : comesBack}
          onContinue={() => onNext(passed)}
        />
      ) : (
        <AnswerPanel
          verdict={null}
          canCheck={typed.trim() !== ""}
          form={formId}
          skipLabel="I do not know"
          onSkip={dontKnow}
        />
      )}
    </>
  );
}

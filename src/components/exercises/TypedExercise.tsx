/* TypedExercise — produce the Dutch word. Two kinds, one answer field:

     active_recall        the English translation, with a part-of-speech
                          hint (or "the" for a noun); type the Dutch.
     sentence_completion  the context sentence with the word blanked, and
                          its English below; type the word in the exact form
                          the sentence needs ("doet", not "doen").

   Type, then Check in the answer panel (Figma "Practice session"); "I do not
   know" reveals the answer — an honest failed retrieval. Answers are graded
   by lib/answerCheck, and the verdict and the word in its context sentence
   show in the panel while the field keeps what was typed. */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { checkAnswer, foldDiacritics, type AnswerCheck } from "../../lib/answerCheck";
import { posHint } from "../../lib/exercises";
import type { ReviewResult } from "../../lib/learningEngine";
import type {
  ContextSentence as Context,
  TargetForm,
} from "../../lib/sentenceTarget";
import type { DictionaryEntry } from "../../lib/types";
import { withArticle, type ExerciseCallbacks } from "./types";
import { speakDutch } from "../../lib/audio";
import { SOUND_MS } from "../../lib/sfx";
import { usePronunciation } from "./usePronunciation";
import { AnswerPanel, notQuite } from "./AnswerPanel";

type Outcome =
  | { kind: "checked"; typed: string; check: AnswerCheck }
  | { kind: "synonym"; typed: string }
  | { kind: "dont_know" };

/** Lower case, accents and a leading article off — for comparing a typed
 *  word with a synonym. */
function bare(text: string): string {
  return foldDiacritics(text.trim().toLowerCase()).replace(/^(de|het|een|'t)\s+/, "").replace(/\s+/g, " ");
}

/** An English noun gloss with "the" in front, unless it already has an
 *  article ("a dog", "the Netherlands"). */
function englishWithArticle(english: string): string {
  return /^(the|a|an)\s/i.test(english.trim()) ? english : `the ${english}`;
}

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
  /** Verified synonyms of this sense (Active Recall): typing one is a half
   *  answer — right, but not proof the target word is known. */
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
  // What's shown as the right answer: the sentence's form (both parts of a
  // split verb: "bel … op"), or the word with its article.
  const parts = sentence?.target.parts ?? [];
  const shown = sentence ? (parts.length > 1 ? parts.map((p) => p.form).join(" … ") : sentence.target.form) : withArticle(entry);
  // Nothing said up front — the word is the answer. Said once it's shown.
  usePronunciation(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (outcome || !typed.trim()) return;
    // A verified synonym of the target (Active Recall only): not a mistake,
    // not proof either — the word comes back soon.
    if (!sentence && bare(typed) !== bare(entry.dutch) && synonyms.some((syn) => bare(syn) === bare(typed))) {
      onResult(entry.id, "synonym");
      setOutcome({ kind: "synonym", typed });
      speakDutch(shown, { delayMs: SOUND_MS.correct });
      return;
    }
    const check = checkAnswer(
      typed,
      sentence
        ? {
            // Both parts of a split verb, in order: "bel op".
            answer: sentence.target.answer,
            dictionaryForm: entry.dutch,
            isOtherWord: isKnownWord,
          }
        : {
            answer: entry.dutch,
            article,
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
    outcome?.kind === "synonym" || (outcome?.kind === "checked" && outcome.check.verdict !== "wrong");
  const right = <strong lang="nl">{shown}</strong>;
  const last = parts[parts.length - 1];
  const after = sentence && last ? sentence.sentence.slice(last.end) : "";
  const trailing = after.match(/^[.,!?;:…»”’)]+/)?.[0] ?? "";
  // What's typed, split over the gaps: "bel op" fills "__ … __".
  const typedParts = parts.length > 1 ? [typed.trim().split(/\s+/)[0] ?? "", typed.trim().split(/\s+/).slice(1).join(" ")] : [typed.trim()];
  const gap = (i: number, width: number) => (
    <span
      className={`exercise__gap${typedParts[i] ? " is-filled" : ""}${outcome ? (passed ? " is-right" : " is-wrong") : ""}`}
      style={{ minWidth: `${Math.max(4, width) + 1}ch` }}
      aria-hidden="true"
    >
      {typedParts[i] || "\u00a0"}
    </span>
  );

  // The panel's title: plain "Correct", or what's worth knowing about the answer.
  let message: ReactNode = null;
  if (outcome?.kind === "synonym") {
    message = (
      <>
        Correct, and the word you’re learning is <em lang="nl">{entry.dutch}</em>.
      </>
    );
  } else if (outcome?.kind === "dont_know") {
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
                {parts.length > 1 ? (
                  <>
                    {sentence.sentence.slice(0, parts[0].start)}
                    {gap(0, parts[0].form.length)}
                    {sentence.sentence.slice(parts[0].end, last.start)}
                    <span className="exercise__gap-line">
                      {gap(1, last.form.length)}
                      {trailing}
                    </span>
                  </>
                ) : (
                  <>
                    {sentence.sentence.slice(0, sentence.target.start)}
                    {/* The gap and any punctuation right after it stay on one
                        line, so a full stop never wraps away on its own. */}
                    <span className="exercise__gap-line">
                      {gap(0, sentence.target.form.length)}
                      {trailing}
                    </span>
                  </>
                )}
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
              {/* The prompt stays in English: a noun reads "the house" (its
                  Dutch article is for the user to produce); any other word
                  keeps its part-of-speech hint. */}
              {!article && posHint(entry) && <p className="exercise__hint">{posHint(entry)}</p>}
              <p className="exercise__word" lang="en">
                {article ? englishWithArticle(entry.english) : entry.english}
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
              placeholder={sentence ? (parts.length > 1 ? "Fill in both parts" : "Fill in the missing word") : "Type the Dutch word"}
              aria-label={sentence ? (parts.length > 1 ? "Both missing parts of the verb, in order" : "The missing Dutch word") : `Dutch for “${entry.english}”`}
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

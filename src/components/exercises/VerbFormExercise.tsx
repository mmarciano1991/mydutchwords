/* VerbFormExercise — type a verb's past tense or past participle ("lopen"
   → "liep", "gelopen"; "opbellen" → "belde op", "opgebeld"). Shown only for
   a verb whose forms are in the dictionary (lib/exerciseData). Graded like
   any typed answer (lib/answerCheck): accents and a small typo are
   "almost". */
import { useId, useMemo, useState, type FormEvent } from "react";
import { checkAnswer, type AnswerCheck } from "../../lib/answerCheck";
import type { DictionaryEntry } from "../../lib/types";
import { speakDutch } from "../../lib/audio";
import { SOUND_MS } from "../../lib/sfx";
import type { ExerciseCallbacks } from "./types";
import { AnswerPanel, notQuite } from "./AnswerPanel";
import { usePronunciation } from "./usePronunciation";

type Ask = "pastSg" | "participle";

const PROMPT: Record<Ask, string> = {
  pastSg: "Past tense (hij/zij)",
  participle: "Past participle (hij heeft / is …)",
};

export function VerbFormExercise({
  entry,
  isKnownWord,
  random = Math.random,
  onResult,
  onNext,
  comesBack,
}: { entry: DictionaryEntry; isKnownWord?: (w: string) => boolean; random?: () => number } & ExerciseCallbacks) {
  const s = entry.snapshot!;
  const ask = useMemo<Ask>(() => (random() < 0.5 ? "pastSg" : "participle"), [random]);
  const answer = (ask === "pastSg" ? s.pastSg : s.participle) ?? "";
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<{ kind: "checked"; check: AnswerCheck } | { kind: "dont_know" } | null>(null);
  const formId = useId();
  const passed = outcome?.kind === "checked" && outcome.check.verdict !== "wrong";
  // The infinitive is the question, not the answer: say it as it appears.
  usePronunciation(entry.dutch);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (outcome || !typed.trim()) return;
    const check = checkAnswer(typed, { answer, isOtherWord: isKnownWord });
    onResult(entry.id, check.verdict);
    setOutcome({ kind: "checked", check });
    speakDutch(answer, { delayMs: SOUND_MS[check.verdict === "wrong" ? "wrong" : "correct"] });
  }

  return (
    <>
      <div className="screen__body gutter exercise exercise--typed">
        <div className="exercise__prompt">
          <p className="exercise__hint">{PROMPT[ask]}</p>
          <p className="exercise__word" lang="nl">
            {entry.dutch}
          </p>
          <p className="exercise__example" lang="en">
            {entry.english}
          </p>
        </div>
        <form id={formId} className="exercise__form" onSubmit={submit}>
          <div className="answer-bar">
            <input
              className="answer-bar__input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              readOnly={outcome !== null}
              placeholder={ask === "pastSg" ? "hij …" : "hij heeft …"}
              aria-label={`${PROMPT[ask]} of ${entry.dutch}`}
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
          message={
            outcome.kind === "dont_know" ? (
              <>
                <span className="answer-panel__soft">The answer is</span> <strong lang="nl">{answer}</strong>
              </>
            ) : passed ? (
              outcome.check.showSpelling ? (
                <>
                  Almost — it’s spelled <strong lang="nl">{answer}</strong>
                </>
              ) : (
                "Correct"
              )
            ) : (
              notQuite(answer)
            )
          }
          entry={entry}
          note={passed ? undefined : comesBack}
          onContinue={() => onNext(passed)}
        />
      ) : (
        <AnswerPanel
          verdict={null}
          canCheck={typed.trim() !== ""}
          form={formId}
          skipLabel="I do not know"
          onSkip={() => {
            if (outcome) return;
            onResult(entry.id, "dont_know");
            setOutcome({ kind: "dont_know" });
            speakDutch(answer);
          }}
        />
      )}
    </>
  );
}

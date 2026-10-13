import { useEffect, useMemo, useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import type { ExerciseType, PlannedStep, ReviewResult, Word } from "../lib/learningEngine";
import { buildEnglishChoices, buildListeningChoices, synonymsOf } from "../lib/exercises";
import {
  answer,
  carryOver,
  comesBackNote,
  createQueue,
  isFinalFor,
  LISTENING_ALTERNATIVE,
  next,
  progress,
  skip,
  type PriorItems,
  type SessionQueue,
} from "../lib/sessionQueue";
import { completionSentence } from "../lib/sentenceTarget";
import { playSound } from "../lib/sfx";
import { preloadDutch } from "../lib/audio";
import { withArticle } from "../components/exercises/types";
import { Appbar } from "../components/Appbar";
import { FlashcardExercise } from "../components/exercises/FlashcardExercise";
import { ChoiceExercise } from "../components/exercises/ChoiceExercise";
import { TypedExercise } from "../components/exercises/TypedExercise";
import { MatchingExercise } from "../components/exercises/MatchingExercise";
import { ArticleExercise } from "../components/exercises/ArticleExercise";
import { VerbFormExercise } from "../components/exercises/VerbFormExercise";
import { hasExerciseData } from "../lib/exerciseData";

export interface PracticeCard {
  entry: DictionaryEntry;
  word: Word;
}

/** One answer, as the screen reports it. What it does to the word is the
 *  learning engine's business (see App → gradeWord). */
export interface StepAnswer {
  wordId: string;
  exerciseType: ExerciseType;
  result: ReviewResult;
  responseTimeMs: number;
  /** This was the word's own exercise (not a flashcard intro in front of
   *  it), so it is the word's answer in the session. */
  final: boolean;
  /** A re-ask from the review queue: never graded, never the word's
   *  session answer. */
  review: boolean;
}

/** One answer's sound. Matching makes its own, pair by pair (its results
 *  are grades: a pair found after a miss is reported "wrong" but sounds
 *  right). "I do not know", skips and flashcard ratings make none — not
 *  knowing isn't a mistake. */
function feedbackSound(kind: Prepared["kind"], result: ReviewResult) {
  if (kind === "unavailable") return;
  if (kind === "matching") return;
  if (PASSED.has(result)) playSound("correct");
  else if (result === "wrong") playSound("wrong");
}

/** Results that master a word. */
const PASSED = new Set<ReviewResult>(["correct", "almost"]);

/** What a step turns into on screen. A step whose content can't be built
 *  (options the deck can't supply, a sentence the word can't be found in)
 *  is skipped and logged — never quietly asked as another exercise. */
type Prepared =
  | { kind: "flashcard" }
  | { kind: "multiple_choice" | "listening"; options: string[] }
  | { kind: "active_recall" }
  | { kind: "sentence_completion"; completion: NonNullable<ReturnType<typeof completionSentence>> }
  | { kind: "matching" }
  | { kind: "article" }
  | { kind: "verb_form" }
  | { kind: "unavailable"; wanted: ExerciseType };

/** The screen title for each exercise (Figma "Practice session" board). */
const TITLE: Record<Prepared["kind"], string> = {
  flashcard: "What does it mean?",
  multiple_choice: "What does it mean?",
  listening: "Listen, and choose the right translation",
  matching: "Match the pairs",
  sentence_completion: "Fill in the missing word",
  active_recall: "Type the Dutch word",
  article: "de or het?",
  verb_form: "Type the verb form",
  unavailable: "",
};

function prepare(step: PlannedStep, entry: DictionaryEntry, pool: DictionaryEntry[], filler: DictionaryEntry[]): Prepared {
  const unavailable = (): Prepared => {
    console.info(`[woordkast] ${step.kind} skipped for ${entry.dutch}: its content couldn't be built`);
    return { kind: "unavailable", wanted: step.kind };
  };
  if (step.kind !== "flashcard" && step.kind !== "matching" && !hasExerciseData(step.kind, entry)) return unavailable();
  switch (step.kind) {
    case "flashcard":
    case "matching":
    case "article":
    case "verb_form":
    case "active_recall":
      return { kind: step.kind };
    case "multiple_choice": {
      const options = buildEnglishChoices(entry, pool, Math.random, filler);
      return options ? { kind: "multiple_choice", options } : unavailable();
    }
    case "listening": {
      const options = buildListeningChoices(entry, pool, Math.random, filler);
      return options ? { kind: "listening", options } : unavailable();
    }
    case "sentence_completion": {
      const completion = completionSentence(entry);
      return completion ? { kind: "sentence_completion", completion } : unavailable();
    }
  }
}

/** What a word is asked as when a step of `kind` can't be shown or answered
 *  ("I can't listen now", options the deck can't supply): Multiple Choice —
 *  the same recognition, without audio — when this word supports it, else its
 *  flashcard, which can always be shown. Never `kind` itself, so a skip can
 *  never lead back to the step it left (an endless run of empty screens). */
export function alternativeFor(kind: ExerciseType, entry: DictionaryEntry, pool: DictionaryEntry[], filler: DictionaryEntry[]): ExerciseType {
  const mc = LISTENING_ALTERNATIVE;
  if (kind !== mc && kind !== "flashcard" && hasExerciseData(mc, entry) && buildEnglishChoices(entry, pool, Math.random, filler)) return mc;
  return "flashcard";
}

/* Practice — one session, played from the learning engine's plan.

   The session walks its planned steps (the main queue), then asks the words
   it missed again (the review queue) until each is right — or, after
   REVIEW_RETRY_LIMIT more misses, hands it on to the next session. Only a
   word's first answer is graded; review answers are re-asks. The order, and
   which words are mastered, live in lib/sessionQueue, and the progress bar
   is derived from it: mastered words over all words in the session.

   A practice round (the ungraded re-go over just-missed words) plays the
   same way; that it's ungraded is the app's business.

   The screen holds no learning rules: each exercise reports what happened,
   and the app runs it through the engine (onAnswer). */
export function Practice({
  steps,
  cards,
  prior,
  pool = [],
  choiceFiller = [],
  isKnownWord,
  onAnswer,
  onFinish,
  onClose,
}: {
  steps: PlannedStep[];
  cards: PracticeCard[];
  /** Words a resumed session already settled — mastered, or still to
   *  review. Its steps hold only what is left. */
  prior?: PriorItems;
  /** The deck — options are drawn from it. */
  pool?: DictionaryEntry[];
  /** Dictionary words that top up Multiple Choice distractors when the deck
   *  is too small to supply them. */
  choiceFiller?: DictionaryEntry[];
  /** True for a real Dutch word (blocks typo tolerance for it). */
  isKnownWord?: (word: string) => boolean;
  /** Fired for every answer, as it is given — an answer the user gave is
   *  not the app's to lose if the session is left half-way. */
  onAnswer: (answer: StepAnswer) => void;
  /** Both queues are done. `deferred`: the words handed on to the next
   *  session. */
  onFinish: (deferred: string[]) => void;
  /** Left part-way. `carryOver`: words still unsettled. */
  onClose: (carryOver: string[]) => void;
}) {
  const byId = useMemo(() => new Map(cards.map((c) => [c.word.id, c.entry])), [cards]);
  // The queue changes several times within one event (a skip, then its
  // Continue), so the ref is the live value and the state re-renders.
  const queueRef = useRef<SessionQueue | null>(null);
  if (queueRef.current === null) {
    // Words that can't be shown (deleted mid-session) are dropped.
    const shown = (id: string) => byId.has(id);
    queueRef.current = createQueue(
      steps.map((s) => ({ ...s, wordIds: s.wordIds.filter(shown) })).filter((s) => s.wordIds.length > 0),
      { completed: prior?.completed?.filter(shown), review: prior?.review?.filter((r) => shown(r.id)) }
    );
  }
  const [queue, setQueue] = useState(queueRef.current);
  const commit = (q: SessionQueue) => {
    queueRef.current = q;
    setQueue(q);
  };

  // Bumped per exercise: re-keys the exercise (fresh state, entry animation).
  const [stepNo, setStepNo] = useState(0);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    shownAt.current = Date.now();
  }, [stepNo]);

  // Every word this session can say, fetched up front: then each one plays
  // the moment it's asked for, inside the tap (iOS), with no wait.
  useEffect(() => {
    for (const c of cards) {
      void preloadDutch(c.entry.dutch);
      if (withArticle(c.entry) !== c.entry.dutch) void preloadDutch(withArticle(c.entry));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing to ask (every word already settled): straight to the report.
  useEffect(() => {
    if (queueRef.current?.current === null) onFinish(carryOver(queueRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = queue.current;
  const entries = (step?.wordIds ?? []).map((id) => byId.get(id)!);
  const entry = entries[0];
  // Built once per step, so options don't reshuffle under a finger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prepared = useMemo(() => (step ? prepare(step, entry, pool, choiceFiller) : null), [stepNo]);

  // A step that can't be shown is skipped: the word is asked another way
  // later (the queue hands it on), and nothing is graded.
  useEffect(() => {
    if (prepared?.kind !== "unavailable" || !step) return;
    for (const id of step.wordIds) report(id, "skipped");
    proceed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);
  if (!step || !prepared || prepared.kind === "unavailable") return null;

  function report(wordId: string, result: ReviewResult) {
    const q = queueRef.current!;
    onAnswer({
      wordId,
      exerciseType: prepared!.kind === "unavailable" ? prepared!.wanted : prepared!.kind,
      result,
      responseTimeMs: Date.now() - shownAt.current,
      final: isFinalFor(q, wordId),
      review: q.current!.review,
    });
    feedbackSound(prepared!.kind, result);
    if (result === "skipped") {
      const skipped = prepared!.kind === "unavailable" ? prepared!.wanted : prepared!.kind;
      commit(skip(q, wordId, alternativeFor(skipped, byId.get(wordId)!, pool, choiceFiller)));
    }
    else if (result !== "exposure") commit(answer(q, wordId, PASSED.has(result) ? "pass" : "miss"));
  }

  /** On to the next step — or, with both queues done, the report. */
  function proceed(passed: boolean) {
    const q = next(queueRef.current!, passed);
    commit(q);
    if (q.current === null) {
      // Every word settled: the session is done.
      playSound("complete");
      onFinish(carryOver(q));
      return;
    }
    setStepNo((n) => n + 1);
  }

  const { mastered, total, value } = progress(queue);
  const callbacks = { onResult: report, onNext: proceed, comesBack: comesBackNote(queue) };
  return (
    <div className="screen">
      <Appbar
        title={TITLE[prepared.kind]}
        onClose={() => onClose(carryOver(queueRef.current!))}
        closeLabel="Close practice"
        progress={{ value, max: total, label: `${mastered} of ${total} words done` }}
      />


      {prepared.kind === "flashcard" && <FlashcardExercise key={stepNo} entry={entry} {...callbacks} />}
      {(prepared.kind === "multiple_choice" || prepared.kind === "listening") && (
        <ChoiceExercise key={stepNo} kind={prepared.kind} entry={entry} options={prepared.options} {...callbacks} />
      )}
      {prepared.kind === "active_recall" && (
        <TypedExercise
          key={stepNo}
          kind="active_recall"
          entry={entry}
          // Same-gloss words anywhere in the dictionary are right too, not
          // only the ones that happen to be in this learner's deck.
          synonyms={synonymsOf(entry)}
          isKnownWord={isKnownWord}
          {...callbacks}
        />
      )}
      {prepared.kind === "sentence_completion" && (
        <TypedExercise
          key={stepNo}
          kind="sentence_completion"
          entry={entry}
          completion={prepared.completion}
          isKnownWord={isKnownWord}
          {...callbacks}
        />
      )}
      {prepared.kind === "matching" && <MatchingExercise key={stepNo} entries={entries} {...callbacks} />}
      {prepared.kind === "article" && <ArticleExercise key={stepNo} entry={entry} {...callbacks} />}
      {prepared.kind === "verb_form" && <VerbFormExercise key={stepNo} entry={entry} isKnownWord={isKnownWord} {...callbacks} />}
    </div>
  );
}

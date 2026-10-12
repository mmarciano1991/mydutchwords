/* exerciseData — which exercises a sense's DATA supports (spec §10).

   Read from fields, never inferred: an exercise whose data is missing is
   skipped and logged (learningEngine's `onSkip`), never quietly swapped for
   another one.

     flashcard            always (exposure, not graded)
     multiple_choice      a short gloss that isn't the Dutch word itself
     matching             a short gloss
     listening            audio (the engine checks) — distractors are built
                          when the step is shown
     sentence_completion  an example sentence with the word located in it
     active_recall        a short gloss that isn't the Dutch word itself
     article              a noun with ONE verified article (not de/het)
     verb_form            a verb with its past tense and participle */
import { contentWords } from "./dictionary/checks";
import type { ExerciseType } from "./learningEngine";
import { completionSentence } from "./sentenceTarget";
import type { DictionaryEntry } from "./types";

/** At most 3 content words — fits a tile and a button. */
export function hasShortGloss(entry: DictionaryEntry): boolean {
  const g = entry.english.trim();
  return g.length > 0 && contentWords(g).length <= 3 && !/[;/]/.test(g.replace(/\([^)]*\)/g, ""));
}

export function isCognateEntry(entry: DictionaryEntry): boolean {
  return Boolean(entry.snapshot?.cognate);
}

export function hasExerciseData(kind: ExerciseType, entry: DictionaryEntry): boolean {
  const s = entry.snapshot;
  switch (kind) {
    case "flashcard":
    case "listening":
      return true;
    case "multiple_choice":
    case "active_recall":
      return hasShortGloss(entry) && !isCognateEntry(entry);
    case "matching":
      return hasShortGloss(entry);
    case "sentence_completion":
      return completionSentence(entry) !== null;
    case "article":
      return Boolean(s && s.pos === "noun" && (s.article === "de" || s.article === "het") && !s.articleUnverified);
    case "verb_form":
      return Boolean(s && s.pos === "verb" && s.kind !== "multiword" && s.pastSg && s.participle && s.separable !== undefined);
  }
}

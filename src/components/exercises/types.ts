import type { ReviewResult } from "../../lib/learningEngine";

/** What every exercise gets from the practice screen. Exercises hold no
 *  learning rules: they report what happened and ask to move on. */
export interface ExerciseCallbacks {
  /** One word's result. */
  onResult: (wordId: string, result: ReviewResult) => void;
  /** Move on. `passed` settles a word the exercise gave no result for (a
   *  flashcard shown in place of an exercise). */
  onNext: (passed: boolean) => void;
  /** Shown under a miss: when the word comes back ("It’ll come back in a
   *  moment.", or next session). */
  comesBack?: string;
}

/** "het huis" for a noun, the bare word otherwise — how an answer is shown. */
export function withArticle(entry: { dutch: string; gender: string }): string {
  return entry.gender === "de" || entry.gender === "het" ? `${entry.gender} ${entry.dutch}` : entry.dutch;
}

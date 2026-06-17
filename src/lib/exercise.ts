import type { Word } from "./types";
import { generateExerciseSentence } from "./anthropic";
import { addToPool, pickFromPool } from "./exerciseCache";

/**
 * Resolve the sentence for a fill-in-the-blank question.
 * Prefers a FRESH AI sentence (and caches it); on failure falls back to a
 * cached one, then to the example saved with the word.
 */
export async function getExerciseSentence(word: Word): Promise<string> {
  const fresh = await generateExerciseSentence(word.dutch);
  if (fresh) {
    addToPool(word.id, fresh);
    return fresh;
  }
  return pickFromPool(word.id) ?? word.exampleSentence;
}

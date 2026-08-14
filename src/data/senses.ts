/* Extra senses — a small, hand-curated overlay for words that carry more
   than one common meaning, layered on top of the bundled dictionary rather
   than folded into it.

   This is deliberately NOT a bulk pass over the 14,193-word curated list
   (see docs/recommendations.md, item 1b: "the authoring pass is never
   done"). It's the opposite bet — a handful of words where the single
   default gloss is actively misleading, prioritised for civic Dutch: the
   vocabulary of letters, forms and signs, where picking the wrong sense
   costs a learner the most (run 04 of the synthetic walkthrough studies,
   docs/studies/run-04-795d03e.md, found this exact failure on a municipal
   letter — "aanslag" read as "attack" rather than "tax assessment").

   Each entry's OWN english/example/exampleEn (in data/curated.ts) is always
   the first, unlabelled sense — these are the ones IN ADDITION to it. Add a
   word here to give it a picker on the capture screen; no build step. */
import type { WordSense } from "../lib/types";

const EXTRA_SENSES: Record<string, WordSense[]> = {
  aanslag: [
    {
      english: "tax assessment / bill",
      example: "Ik kreeg een aanslag van de gemeente.",
      exampleEn: "I received a tax assessment from the municipality.",
      gender: "de",
      label: "tax / municipal",
    },
  ],
  weken: [
    {
      english: 'weeks (plural of "week")',
      example: "U heeft zes weken de tijd om te reageren.",
      exampleEn: "You have six weeks to respond.",
      gender: "de",
      label: "noun, plural",
    },
  ],
  uiterlijk: [
    {
      english: "appearance / looks",
      example: "Haar uiterlijk veranderde niet.",
      exampleEn: "Her appearance didn't change.",
      gender: "het",
      label: "noun",
    },
  ],
};

/** Senses beyond a word's own default gloss, or [] for the ~14,190 words
 *  that only have one. */
export function extraSensesFor(id: string): WordSense[] {
  return EXTRA_SENSES[id] ?? [];
}

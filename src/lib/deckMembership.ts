/* deckMembership — "is this sense already in the deck?", per SENSE id.

   A deck saved before the server dictionary holds legacy cards ("aanslag",
   "aanslag#1") with their own ids. So the same meaning isn't added twice,
   a dictionary sense also counts as in the deck when a legacy card has the
   same word and the same meaning (its gloss shares a content word). */
import { contentWords } from "./dictionary/checks";
import type { SenseSnapshot } from "./dictionary/model";
import { searchKey } from "./dictionary/normalize";
import type { DictionaryEntry } from "./types";

export interface DeckMembership {
  has: (sense: Pick<SenseSnapshot, "senseId" | "form" | "gloss">) => boolean;
  /** Word ids with at least one sense in the deck — for suggestion rows. */
  wordIds: Set<string>;
}

export function deckMembership(entries: DictionaryEntry[]): DeckMembership {
  const ids = new Set(entries.map((e) => e.id));
  const wordIds = new Set<string>();
  const legacy = new Map<string, DictionaryEntry[]>();
  for (const e of entries) {
    if (e.snapshot) wordIds.add(e.snapshot.wordId);
    else {
      wordIds.add(e.dutch);
      const k = searchKey(e.dutch);
      if (!legacy.has(k)) legacy.set(k, []);
      legacy.get(k)!.push(e);
    }
  }
  return {
    wordIds,
    has(sense) {
      if (ids.has(sense.senseId)) return true;
      const cards = legacy.get(searchKey(sense.form));
      if (!cards) return false;
      const words = new Set(contentWords(sense.gloss));
      return cards.some((c) => contentWords(c.english.replace(/\//g, " ")).some((w) => words.has(w)));
    },
  };
}

import type { Lookup } from "./types";

/**
 * Offline fallback used when no Anthropic API key is configured (or a call
 * fails). It keeps the end-to-end demo working with zero setup: known words
 * get a real translation + natural sentence; anything else gets a templated
 * sentence so the fill-in-the-blank exercise still has something to blank out.
 */
const SEED: Record<string, Lookup> = {
  gewoonte: {
    translation: "habit",
    example_sentence: "Het is een goede gewoonte om elke dag te lezen.",
  },
  artikel: {
    translation: "article",
    example_sentence: "Ik heb een interessant artikel over Amsterdam gelezen.",
  },
  schilderij: {
    translation: "painting",
    example_sentence: "Het schilderij hangt aan de muur in de woonkamer.",
  },
  vertaling: {
    translation: "translation",
    example_sentence: "De vertaling van dit woord was niet makkelijk.",
  },
  aandacht: {
    translation: "attention",
    example_sentence: "Hij vraagt de hele dag om aandacht.",
  },
  tentoonstelling: {
    translation: "exhibition",
    example_sentence: "De tentoonstelling in het museum trok veel bezoekers.",
  },
  fiets: {
    translation: "bicycle",
    example_sentence: "Ik ga met de fiets naar mijn werk.",
  },
  huis: {
    translation: "house",
    example_sentence: "Hun huis staat aan een rustige gracht.",
  },
  boek: {
    translation: "book",
    example_sentence: "Zij leest elke avond een boek voor het slapen.",
  },
  water: {
    translation: "water",
    example_sentence: "Wil je een glas water bij het eten?",
  },
  brood: {
    translation: "bread",
    example_sentence: "We kopen elke ochtend vers brood bij de bakker.",
  },
  trein: {
    translation: "train",
    example_sentence: "De trein naar Utrecht vertrekt over tien minuten.",
  },
  koffie: {
    translation: "coffee",
    example_sentence: "Zullen we ergens een kopje koffie drinken?",
  },
  vriend: {
    translation: "friend",
    example_sentence: "Mijn vriend woont al jaren in Rotterdam.",
  },
  werk: {
    translation: "work",
    example_sentence: "Na het werk ga ik nog even sporten.",
  },
  stad: {
    translation: "city",
    example_sentence: "Delft is een mooie oude stad in Zuid-Holland.",
  },
  weer: {
    translation: "weather",
    example_sentence: "Het weer is vandaag wisselvallig en koud.",
  },
  kaas: {
    translation: "cheese",
    example_sentence: "Op de markt verkopen ze heerlijke oude kaas.",
  },
};

export function fallbackLookup(dutch: string): Lookup {
  const key = dutch.trim().toLowerCase();
  const hit = SEED[key];
  if (hit) return hit;

  // Generic but usable: the sentence contains the word so it can be blanked.
  const word = dutch.trim();
  return {
    translation: `${word} (add the meaning yourself)`,
    example_sentence: `Ik kom het woord ${word} vaak tegen in het Nederlands.`,
  };
}

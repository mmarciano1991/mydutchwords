import type { Lookup } from "./types";

/**
 * Offline fallback used when the AI proxy is unreachable or not configured yet.
 * It keeps the app usable with zero setup: known words get a real translation,
 * gender, and natural sentence; anything else gets a templated sentence so the
 * fill-in-the-blank exercise still has something to blank out.
 */
const SEED: Record<string, Lookup> = {
  gewoonte: { translation: "habit", gender: "de", example_sentence: "Het is een goede gewoonte om elke dag te lezen." },
  artikel: { translation: "article", gender: "het", example_sentence: "Ik heb een interessant artikel over Amsterdam gelezen." },
  schilderij: { translation: "painting", gender: "het", example_sentence: "Het schilderij hangt aan de muur in de woonkamer." },
  vertaling: { translation: "translation", gender: "de", example_sentence: "De vertaling van dit woord was niet makkelijk." },
  aandacht: { translation: "attention", gender: "de", example_sentence: "Hij vraagt de hele dag om aandacht." },
  tentoonstelling: { translation: "exhibition", gender: "de", example_sentence: "De tentoonstelling in het museum trok veel bezoekers." },
  fiets: { translation: "bicycle", gender: "de", example_sentence: "Ik ga met de fiets naar mijn werk." },
  huis: { translation: "house", gender: "het", example_sentence: "Hun huis staat aan een rustige gracht." },
  boek: { translation: "book", gender: "het", example_sentence: "Zij leest elke avond een boek voor het slapen." },
  water: { translation: "water", gender: "het", example_sentence: "Wil je een glas water bij het eten?" },
  brood: { translation: "bread", gender: "het", example_sentence: "We kopen elke ochtend vers brood bij de bakker." },
  trein: { translation: "train", gender: "de", example_sentence: "De trein naar Utrecht vertrekt over tien minuten." },
  koffie: { translation: "coffee", gender: "de", example_sentence: "Zullen we ergens een kopje koffie drinken?" },
  vriend: { translation: "friend", gender: "de", example_sentence: "Mijn vriend woont al jaren in Rotterdam." },
  werk: { translation: "work", gender: "het", example_sentence: "Na het werk ga ik nog even sporten." },
  stad: { translation: "city", gender: "de", example_sentence: "Delft is een mooie oude stad in Zuid-Holland." },
  weer: { translation: "weather", gender: "het", example_sentence: "Het weer is vandaag wisselvallig en koud." },
  kaas: { translation: "cheese", gender: "de", example_sentence: "Op de markt verkopen ze heerlijke oude kaas." },
};

export function fallbackLookup(dutch: string): Lookup {
  const key = dutch.trim().toLowerCase();
  const hit = SEED[key];
  if (hit) return hit;

  const word = dutch.trim();
  return {
    translation: `${word} (add the meaning yourself)`,
    gender: null,
    example_sentence: `Ik kom het woord ${word} vaak tegen in het Nederlands.`,
  };
}

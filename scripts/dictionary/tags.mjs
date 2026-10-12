/* Mapping Wiktionary (wiktextract) parts of speech and tags onto the
   dictionary's model. Both Wiktionaries use the same tag vocabulary. */

/** wiktextract pos → our category. `kind` overrides the word kind. Anything
 *  not listed (affixes, symbols, letters, proverbs) is not a dictionary
 *  word for this app. */
export const POS_MAP = {
  noun: { pos: "noun" },
  name: { pos: "noun", subtype: "proper", kind: "properNoun" },
  verb: { pos: "verb" },
  adj: { pos: "adjective" },
  adv: { pos: "adverb" },
  prep: { pos: "preposition", subtype: "preposition" },
  postp: { pos: "preposition", subtype: "postposition" },
  circumpos: { pos: "preposition", subtype: "circumposition" },
  prep_phrase: { pos: "preposition", subtype: "preposition", kind: "multiword" },
  pron: { pos: "pronoun" },
  det: { pos: "pronoun" },
  conj: { pos: "conjunction" },
  num: { pos: "numeral" },
  intj: { pos: "interjection" },
  article: { pos: "article" },
  particle: { pos: "adverb", subtype: "modal particle" },
  phrase: { pos: "interjection", subtype: "formula", kind: "multiword" },
  abbrev: { pos: "noun", kind: "abbreviation" },
};

/** Senses with any of these tags are not offered at all. */
export const EXCLUDED_SENSE_TAGS = new Set([
  "obsolete",
  "misspelling",
  "nonstandard",
  "Suriname",
  "South-Africa",
  "Antilles",
  "Aruba",
  "Curaçao",
  "dialectal",
  "uncommon-misspelling",
]);

const BE_TAGS = new Set(["Belgium", "Flanders", "Flemish", "Brabant", "Brabantian", "Southern", "Limburg", "Antwerp", "Ghent"]);

/** NL (default) or BE. */
export function varietyOf(tags = []) {
  return tags.some((t) => BE_TAGS.has(t)) ? "BE" : "NL";
}

/** formal · informal · vulgar · archaic · rare, or undefined. */
export function registerOf(tags = []) {
  const has = (...names) => names.some((n) => tags.includes(n));
  if (has("vulgar", "offensive", "derogatory", "pejorative", "ethnic", "slur")) return "vulgar";
  if (has("archaic", "dated", "poetic", "historical")) return "archaic";
  if (has("rare", "uncommon")) return "rare";
  if (has("informal", "colloquial", "slang", "Internet", "childish", "familiar")) return "informal";
  if (has("formal", "literary", "bureaucratese", "legal")) return "formal";
  return undefined;
}

/** Articles from Wiktionary gender codes: m/f → de, n → het, both → de/het.
 *  Plurale tantum (p) → de. */
export function articleFromGenders(genders) {
  const g = new Set(genders);
  const de = g.has("m") || g.has("f") || g.has("p") || g.has("c");
  const het = g.has("n");
  if (de && het) return "de/het";
  if (het) return "het";
  if (de) return "de";
  return undefined;
}

/** Gender codes from wiktextract tags (nl-wiktionary entries). */
export function gendersFromTags(tags = []) {
  const out = [];
  if (tags.includes("masculine")) out.push("m");
  if (tags.includes("feminine")) out.push("f");
  if (tags.includes("neuter")) out.push("n");
  if (tags.includes("common")) out.push("c");
  if (tags.includes("plural-only") || tags.includes("plurale-tantum")) out.push("p");
  return out;
}

const PRONOUN_SUBTYPES = ["personal", "possessive", "reflexive", "reciprocal", "demonstrative", "interrogative", "relative", "indefinite"];

export function pronounSubtype(tags = []) {
  return PRONOUN_SUBTYPES.find((t) => tags.includes(t)) ?? "personal";
}

export function nounSubtype({ kind, tags = [], genders = [], isDiminutive }) {
  if (kind === "properNoun") return "proper";
  if (isDiminutive) return "diminutive";
  if (genders.includes("p") || tags.includes("plural-only")) return "plurale tantum";
  if (tags.includes("uncountable") || tags.includes("singular-only")) return "singular only";
  return "common";
}

export function verbSubtype({ separable, tags = [], word }) {
  if (["kunnen", "moeten", "mogen", "willen", "zullen", "hoeven"].includes(word)) return "modal";
  if (separable) return "separable";
  if (tags.includes("reflexive")) return "reflexive";
  if (tags.includes("impersonal")) return "impersonal";
  if (tags.includes("copulative")) return "copular";
  if (tags.includes("auxiliary")) return "auxiliary";
  return "inseparable";
}

/** Domain from wiktextract topics, in plain English — a short label. */
export function domainOf(topics = []) {
  const map = {
    "government": "civic", "law": "legal", "legal": "legal", "finance": "finance", "financial": "finance", "taxation": "civic",
    "medicine": "health", "healthcare": "health", "business": "work", "economics": "work", "computing": "computing",
    "education": "education", "cooking": "food", "food": "food", "sports": "sport", "religion": "religion",
  };
  for (const t of topics) if (map[t]) return map[t];
  return undefined;
}

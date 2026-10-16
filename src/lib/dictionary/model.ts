/* ──────────────────────────────────────────────────────────────────────────
   The dictionary's data model — shared by the build pipeline
   (scripts/dictionary/) and the app.

   Four levels: Word → Grammatical use → Sense → Example. A word is never
   duplicated: every use and sense of "was" (a form of zijn and wassen, and
   the noun de was) hangs off one Word. The deck references a SENSE, by a
   stable id.

   Every field that comes from a source carries where it came from and how
   sure the pipeline is of it (`FieldMeta`): two sources agreeing is
   "verified", one source that passed every mechanical check is "checked",
   and sources disagreeing is "doubt" — which never ships. A field that is
   missing stays missing; the app says so instead of filling it.

   This file has no imports (its only code is constants and previewOf), so
   the Node pipeline can import it directly (type stripping) as well as
   Vite.
   ────────────────────────────────────────────────────────────────────────── */

export type Confidence = "verified" | "checked" | "doubt";

/** Where a value came from. */
export type SourceName =
  | "en-wiktionary"
  | "nl-wiktionary"
  | "opentaal"
  | "frequency"
  | "tatoeba"
  | "pipeline"
  | "llm"
  /** A person's reviewed correction (data/corrections). */
  | "review"
  | "user";

export interface FieldMeta {
  sources: SourceName[];
  confidence: Confidence;
}

/** The categories of POS_LABELS (lib/exercises) plus `article`. */
export type Pos =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "preposition"
  | "pronoun"
  | "conjunction"
  | "numeral"
  | "interjection"
  | "article";

export const POS_ORDER: readonly Pos[] = [
  "article",
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "numeral",
  "interjection",
];

/** Short English label shown in the part-of-speech pill. */
export const POS_LABEL: Record<Pos, string> = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  preposition: "Preposition",
  pronoun: "Pronoun",
  conjunction: "Conjunction",
  numeral: "Numeral",
  interjection: "Interjection",
  article: "Article",
};

export type WordKind = "word" | "multiword" | "compound" | "abbreviation" | "properNoun";

/** de, het, or the legitimate double (de/het filter). */
export type Article = "de" | "het" | "de/het";

export type Variety = "NL" | "BE";
export type Register = "formal" | "informal" | "vulgar" | "archaic" | "rare";

/** One node of a compound's binary tree. The right branch is the head: it
 *  gives the compound its article and plural. */
export interface CompoundNode {
  form: string;
  /** Joint between left and right ("s", "en", "e", "er", "-"), or "" for none. */
  link?: string;
  componentKind: "lemma" | "properNoun" | "abbreviation";
  /** The dictionary word this part is, when it is a lemma. */
  wordId?: string;
  left?: CompoundNode;
  right?: CompoundNode;
}

export type MorphemeType = "separablePrefix" | "inseparablePrefix" | "on" | "root" | "suffix";

export interface Syllables {
  parts: string[];
  stressed: number;
}

export interface Morpheme {
  text: string;
  type: MorphemeType;
}

/** An inflected form, and what it is. Every form points back to its use. */
export interface InflectedForm {
  form: string;
  tags: string[];
}

export interface Example {
  nl: string;
  en: string;
  /** [start, end) of the word in `nl`; two spans for a split separable verb
   *  ("bel" … "op"). */
  targetSpans: [number, number][];
  targetSpansEn?: [number, number][];
  /** captured: the learner's own sentence. corpus: a real sentence from a
   *  corpus (Wiktionary usage examples, Tatoeba). generated: written by the
   *  model for this sense and passed every check. user: edited by the
   *  learner. */
  source: "captured" | "corpus" | "generated" | "user";
  /** Which corpus, for `corpus` examples. */
  origin?: "wiktionary" | "tatoeba";
}

export interface Sense {
  /** Stable. Deck membership and progress hang on it. */
  id: string;
  /** English, short, one meaning: at most 3 content words plus an optional
   *  parenthetical. */
  gloss: string;
  /** Only when it differs from the use's (het bal, the formal dance). */
  article?: Article;
  /** Only when it differs from the use's (bals for het bal). */
  plural?: string;
  /** From Dutch Wiktionary only, never generated. Not shown in the MVP. */
  explanationNl?: string;
  /** Short usage context ("on letters from the gemeente"). */
  glossNote?: string;
  variety: Variety;
  register?: Register;
  domain?: string;
  /** Position by frequency; BE, archaic and rare always last. */
  rank: number;
  /** Verified lemmas only. */
  synonyms: string[];
  antonyms: string[];
  examples: Example[];
  /** The gloss was rebuilt from a compound's parts, not found whole. */
  reconstructed?: boolean;
  meta: FieldMeta;
}

export type VerbAuxiliary = "hebben" | "zijn" | "both";

export interface Use {
  /** Stable within the word: `${pos}` or `${pos}.${n}` for a second use of
   *  the same category (vóórkomen / voorkómen). */
  id: string;
  pos: Pos;
  subtype: string;
  /** Every inflected form, each pointing back to this use. */
  forms: InflectedForm[];
  /** The headword with the stressed vowel marked, when stress tells two
   *  uses apart (vóórkomen / voorkómen). */
  stress?: string;
  // nouns
  article?: Article;
  articleNote?: string;
  plural?: string;
  plural2?: string;
  diminutive?: string;
  // verbs
  present3sg?: string;
  /** Full present for irregular and modal verbs: ik ben, jij bent, hij is. */
  present?: { person: string; form: string }[];
  pastSg?: string;
  pastPl?: string;
  participle?: string;
  auxiliary?: VerbAuxiliary;
  separable?: boolean;
  /** "bel … op" */
  separableSplit?: string;
  /** Fixed preposition ("wachten op"). */
  governs?: string;
  irregular?: boolean;
  // adjectives
  inflected?: string;
  comparative?: string;
  superlative?: string;
  // abbreviations
  expansion?: string;
  // multiword units
  pattern?: string;
  head?: string;
  /** Confidence per grammatical field ("article", "plural", "participle"…). */
  fieldMeta: Record<string, FieldMeta>;
  senses: Sense[];
}

export interface WordEntry {
  /** The canonical form — also the word's id. */
  id: string;
  form: string;
  kind: WordKind;
  variants: string[];
  compound?: CompoundNode;
  opaque?: boolean;
  morphemes?: Morpheme[];
  /** Syllables (from the hyphenation) and which one is stressed (from the
   *  IPA) — only when both sources agree on the syllable count. */
  syllables?: Syllables;
  /** Rank in the frequency list (1 = most common); larger = rarer. */
  frequency: number;
  searchKey: string;
  meta: FieldMeta;
  uses: Use[];
}

/** One row of the search index: a key that leads to a word. */
export interface KeyRow {
  key: string;
  wordId: string;
  /** How the key reaches the word: its own form, an inflected form, a
   *  spelling variant, or (abbreviations) the expansion. */
  via: "lemma" | "form" | "variant" | "expansion";
  /** The text that matched, as written ("liep"). */
  form: string;
  /** The use an inflected form belongs to. */
  useId?: string;
  frequency: number;
}

/** A sense flattened with everything a card or an exercise needs about its
 *  word and use — what the deck stores locally (see lib/wordSources). */
export interface SenseSnapshot {
  senseId: string;
  wordId: string;
  form: string;
  kind: WordKind;
  pos: Pos;
  useId: string;
  article?: Article;
  /** The article is single-source or missing. */
  articleUnverified?: boolean;
  gloss: string;
  glossNote?: string;
  variety: Variety;
  register?: Register;
  synonyms: string[];
  antonyms: string[];
  examples: Example[];
  reconstructed?: boolean;
  forms: InflectedForm[];
  plural?: string;
  pastSg?: string;
  pastPl?: string;
  participle?: string;
  separable?: boolean;
  separableSplit?: string;
  auxiliary?: VerbAuxiliary;
  stress?: string;
  morphemes?: Morpheme[];
  syllables?: Syllables;
  compound?: CompoundNode;
  expansion?: string;
  /** The gloss is (close to) the Dutch word itself — sauna, podcast. */
  cognate: boolean;
}

/** What a suggestion row shows without fetching the full entry: the first
 *  few senses, each with its article and part of speech. */
export interface PreviewSense {
  senseId: string;
  useId: string;
  pos: Pos;
  article?: Article;
  gloss: string;
  /** BE, archaic or rare — listed last. */
  late?: boolean;
}

export interface WordPreview {
  senses: PreviewSense[];
  /** Total senses across uses, for "+3 more". */
  senseCount: number;
  compound?: boolean;
}

/** The preview for a word — computed the same way by the pipeline (stored
 *  on the server) and by the static source. */
export function previewOf(word: WordEntry, max = 3): WordPreview {
  const all: PreviewSense[] = [];
  for (const use of word.uses) {
    for (const s of use.senses) {
      all.push({
        senseId: s.id,
        useId: use.id,
        pos: use.pos,
        article: s.article ?? use.article,
        gloss: s.gloss,
        late: s.variety === "BE" || s.register === "archaic" || s.register === "rare" || undefined,
      });
    }
  }
  const ordered = [...all.filter((s) => !s.late), ...all.filter((s) => s.late)];
  return { senses: ordered.slice(0, max), senseCount: all.length, compound: Boolean(word.compound) || undefined };
}

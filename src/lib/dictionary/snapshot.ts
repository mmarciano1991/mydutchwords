/* From a dictionary entry to what the deck stores and the screens show.

   A deck item references a SENSE id. What the deck keeps locally is a
   snapshot of that sense with everything a card or an exercise needs about
   its word and use (article, forms, examples, synonyms…), so practice works
   offline and a dictionary update can be merged in later without touching
   what the learner edited (see lib/wordSources). */
import type { DictionaryEntry, Gender } from "../types";
import { isCognate } from "./checks";
import type { Article, PreviewSense, SenseSnapshot, Sense, Use, WordEntry } from "./model";
import { searchKey } from "./normalize";

/** The article a sense shows: its own, else its use's. */
export function articleOf(use: Use, sense: Sense): Article | undefined {
  return sense.article ?? use.article;
}

/** True when a noun's article is missing or single-source — the app then
 *  says "Article not verified yet". */
export function articleUnverified(use: Use): boolean {
  if (use.pos !== "noun") return false;
  return !use.article || use.fieldMeta.article?.confidence !== "verified";
}

export function snapshotOf(word: WordEntry, use: Use, sense: Sense): SenseSnapshot {
  return {
    senseId: sense.id,
    wordId: word.id,
    form: word.form,
    kind: word.kind,
    pos: use.pos,
    useId: use.id,
    article: use.pos === "noun" ? articleOf(use, sense) : undefined,
    articleUnverified: articleUnverified(use) || undefined,
    gloss: sense.gloss,
    glossNote: sense.glossNote,
    variety: sense.variety,
    register: sense.register,
    synonyms: sense.synonyms,
    antonyms: sense.antonyms,
    examples: sense.examples,
    reconstructed: sense.reconstructed,
    forms: use.forms,
    plural: sense.plural ?? use.plural,
    pastSg: use.pastSg,
    pastPl: use.pastPl,
    participle: use.participle,
    separable: use.separable,
    separableSplit: use.separableSplit,
    auxiliary: use.auxiliary,
    stress: use.stress,
    morphemes: word.morphemes,
    syllables: word.syllables,
    compound: word.compound,
    expansion: use.expansion,
    cognate: isCognate(word.form, sense.gloss),
  };
}

/** The gender chip value for a snapshot: de, het, the double (shown as
 *  "de/het"), none for non-nouns, unknown for a noun with no article. */
export function genderOf(s: Pick<SenseSnapshot, "pos" | "article">): Gender {
  if (s.pos !== "noun") return "none";
  if (s.article === "de" || s.article === "het") return s.article;
  if (s.article === "de/het") return "de/het";
  return "unknown";
}

/** The app-wide entry for one sense — what the deck, the practice screen
 *  and the exercises read. Keyed by sense id. */
export function entryOf(snapshot: SenseSnapshot): DictionaryEntry {
  const example = snapshot.examples[0];
  const gender = genderOf(snapshot);
  return {
    id: snapshot.senseId,
    dutch: snapshot.form,
    english: snapshot.gloss,
    gender,
    example: example?.nl ?? "",
    exampleEn: example?.en ?? "",
    senses: [
      {
        english: snapshot.gloss,
        example: example?.nl ?? "",
        exampleEn: example?.en ?? "",
        gender,
        label: snapshot.pos,
        context: snapshot.glossNote,
        source: example?.source === "generated" ? "generated" : "curated",
      },
    ],
    snapshot,
  };
}

/** Every sense of a word as entries, in display order: uses in order, then
 *  senses by rank. */
export function entriesOfWord(word: WordEntry, useIds?: string[] | null): DictionaryEntry[] {
  const out: DictionaryEntry[] = [];
  for (const use of word.uses) {
    if (useIds && !useIds.includes(use.id)) continue;
    for (const sense of [...use.senses].sort((a, b) => a.rank - b.rank)) out.push(entryOf(snapshotOf(word, use, sense)));
  }
  return out;
}

/** An entry from a suggestion preview — enough for a distractor or a
 *  starter list, not for a deck card (no forms, no examples). */
export function entryFromPreview(wordId: string, form: string, p: PreviewSense): DictionaryEntry {
  return entryOf({
    senseId: p.senseId,
    wordId,
    form,
    kind: "word",
    pos: p.pos,
    useId: p.useId,
    article: p.pos === "noun" ? p.article : undefined,
    gloss: p.gloss,
    variety: p.late ? "BE" : "NL",
    synonyms: [],
    antonyms: [],
    examples: [],
    forms: [],
    cognate: isCognate(form, p.gloss),
  });
}

/** A word the dictionary doesn't have, with the learner's own translation:
 *  no part of speech, no article claimed, marked personal. */
export function personalEntry(form: string, translation: string, sentence?: string): DictionaryEntry {
  const clean = form.trim();
  return {
    id: `p_${searchKey(clean)}`,
    dutch: clean,
    english: translation,
    gender: "none",
    example: "",
    exampleEn: "",
    senses: [{ english: translation, example: "", exampleEn: "", gender: "none" }],
    metIn: sentence,
    personal: true,
    userEdited: ["english"],
  };
}

/** A sense from the online dictionary (Wiktionary, fetched live) — shown
 *  only when the word isn't in ours, always with its source, and never
 *  claiming more than it has: no article unless the page states one. */
export function onlineEntry(form: string, index: number, gloss: string, label: string | undefined, gender: DictionaryEntry["gender"]): DictionaryEntry {
  const pos = (label ?? "").toLowerCase();
  const known = ["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "numeral", "interjection", "article"];
  const entry = entryOf({
    senseId: `o_${searchKey(form)}_${index}`,
    wordId: form,
    form,
    kind: "word",
    pos: (known.includes(pos) ? pos : "noun") as SenseSnapshot["pos"],
    useId: pos || "online",
    article: gender === "de" || gender === "het" ? gender : undefined,
    articleUnverified: true,
    gloss,
    variety: "NL",
    synonyms: [],
    antonyms: [],
    examples: [],
    forms: [],
    cognate: isCognate(form, gloss),
  });
  return { ...entry, gender: known.includes(pos) && pos !== "noun" ? "none" : entry.gender, senses: entry.senses.map((s) => ({ ...s, source: "online" })) };
}

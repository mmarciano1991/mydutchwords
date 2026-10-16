/* Corrections — the quality pass over what the sources give us.

   Tier 0, rules (free, every build):
     - a place-name sense on a common word ("appel: hamlet in Nijkerk") is
       dropped — it comes from Wiktionary's proper-noun entries spelled like
       the word, and a learner saving "appel" must never get a hamlet;
     - two senses of one use with the same gloss are merged into the first,
       which keeps an example either of them had.

   Reviewed corrections (data/corrections/*.tsv — one file per kind below; any name starting with the kind works, written by the review —
   scripts/dictionary/review.mjs — and checked by a person before merging):
     glosses-*.tsv    form  pos  gloss  new gloss
     examples-*.tsv   form  pos  gloss  nl  en      replaces the example
     drop-*.tsv       form  pos  gloss  reason
     articles-*.tsv   form  pos  gloss  de|het      both review models agreed
     noexample-*.tsv  form  pos  gloss              the example no longer fits
                                                    the corrected gloss
     grammar-*.tsv    form  pos  field  from  value  where the two Wiktionaries
                                                    disagree (article, plural,
                                                    participle, pastSg): the
                                                    value, one of theirs
     abbreviations-*.tsv  form  pos  expansion  gloss   an abbreviation whose
                                                    expansion has no English
                                                    meaning of its own
   A line names the sense the way the learner sees it (form, part of speech,
   gloss), like stored examples (stored.mjs); one whose sense no longer
   exists is unused. Nothing is trusted: a replaced example passes the same
   checks as any other (build.mjs), and fails into the doubt queue. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./paths.mjs";
import { storedKey } from "./stored.mjs";

export const CORRECTIONS_DIR = join(ROOT, "data", "corrections");

/** "hamlet in Nijkerk", "neighbourhood of Amsterdam" — a place's description. */
const PLACE = /^(hamlet|village|neighbou?rhood|town|city|municipality|former municipality|suburb|district|polder|settlement|street|quarter|borough)( and [a-z ]+)? (in|of|near) \p{Lu}/u;

/** Why Tier 0 drops this sense, or null. Proper nouns ("Bade") keep theirs. */
export function tier0Drop(word, sense) {
  if (PLACE.test(sense.gloss ?? "") && !/^\p{Lu}/u.test(word.form)) return "place name on a common word";
  return null;
}

/** Merges senses of `use` whose glosses are identical into the first one,
 *  keeping the first example either had. Returns how many were merged. */
export function mergeDuplicateSenses(use) {
  const first = new Map();
  let merged = 0;
  use.senses = use.senses.filter((s) => {
    const k = (s.gloss ?? "").trim().toLowerCase();
    const keep = first.get(k);
    if (!keep) {
      first.set(k, s);
      return true;
    }
    if (!keep.examples?.length && s.examples?.length) keep.examples = s.examples;
    if (!keep._rawExamples?.length && s._rawExamples?.length) keep._rawExamples = s._rawExamples;
    merged++;
    return false;
  });
  return merged;
}

function readTsv(dir, prefix, columns) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".tsv")).sort()) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      const cells = line.split("\t").map((c) => c.normalize("NFC").trim());
      if (cells.length < columns || cells.slice(0, columns).some((c) => !c)) continue;
      out.set(storedKey(cells[0], cells[1], cells[2]), { cells: cells.slice(3), file });
    }
  }
  return out;
}

/** Glosses condensed by the model step and saved after review
 *  (condensed.tsv: form, pos, source gloss, gloss), keyed by
 *  storedKey(form, pos, source gloss). */
export function loadCondensed(dir = CORRECTIONS_DIR) {
  return new Map([...readTsv(dir, "condensed", 4)].map(([k, v]) => [k, v.cells[0]]));
}

/** Grammar disagreements settled by review (grammar.tsv: form, pos, field,
 *  English Wiktionary's value, the value to use), keyed by grammarKey. */
export const grammarKey = (form, pos, field, from) => [form, pos, field, from].map((c) => String(c).normalize("NFC").trim()).join("\t");
export function loadGrammar(dir = CORRECTIONS_DIR) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.startsWith("grammar") && f.endsWith(".tsv")).sort()) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      const cells = line.split("\t").map((c) => c.normalize("NFC").trim());
      if (cells.length < 5 || cells.slice(0, 5).some((c) => !c)) continue;
      out.set(grammarKey(...cells.slice(0, 4)), cells[4]);
    }
  }
  return out;
}

/** English meanings for abbreviations whose expansion gives none
 *  (abbreviations.tsv: form, pos, expansion, gloss), keyed by
 *  storedKey(form, pos, expansion). */
export function loadAbbreviations(dir = CORRECTIONS_DIR) {
  return new Map([...readTsv(dir, "abbreviations", 4)].map(([k, v]) => [k, v.cells[0]]));
}

/** Every reviewed correction, keyed by storedKey(form, pos, gloss). */
export function loadCorrections(dir = CORRECTIONS_DIR) {
  return {
    glosses: new Map([...readTsv(dir, "glosses", 4)].map(([k, v]) => [k, { gloss: v.cells[0], file: v.file }])),
    examples: new Map([...readTsv(dir, "examples", 5)].map(([k, v]) => [k, { nl: v.cells[0], en: v.cells[1], file: v.file }])),
    drops: new Map([...readTsv(dir, "drop", 3)].map(([k, v]) => [k, { reason: v.cells[0] ?? "reviewed", file: v.file }])),
    articles: new Map([...readTsv(dir, "articles", 4)].filter(([, v]) => v.cells[0] === "de" || v.cells[0] === "het").map(([k, v]) => [k, { article: v.cells[0], file: v.file }])),
    noExamples: new Set(readTsv(dir, "noexample", 3).keys()),
  };
}

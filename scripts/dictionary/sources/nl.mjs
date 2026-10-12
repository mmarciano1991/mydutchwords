/* Dutch Wiktionary (via kaikki.org / wiktextract).

   The second, independent source. Used to CHECK what English Wiktionary
   says — gender, plural, verb forms, part of speech — and to add what only
   it has: English translations per sense (huurtoeslag → housing benefit),
   Dutch explanations (explanationNl), the perfect auxiliary (zijn
   aangekomen), and words English Wiktionary lacks (zzp'er, GGD, BSN). */
import { join } from "node:path";
import { eachJsonl } from "../io.mjs";
import { CACHE_DIR } from "../paths.mjs";
import { EXCLUDED_SENSE_TAGS, POS_MAP, gendersFromTags } from "../tags.mjs";

/** One Wiktionary form cell, as forms: "NL: leraren" → leraren,
 *  "aangiften, aangiftes" → both, "zou en zouden*" → zou, zouden. Labels,
 *  footnote marks and lists are formatting, not part of the word. */
export function cleanForms(cell) {
  return cell
    .normalize("NFC")
    .split(/,\s*|\s+(?:en|of)\s+|\s*\/\s*/)
    .map((x) => x.replace(/^(NL|BE|SR|VL)\s*:\s*/i, "").replace(/[*†]+$/, "").trim())
    .filter(Boolean);
}

export async function loadNlWiktionary() {
  const entries = new Map();
  await eachJsonl(join(CACHE_DIR, "nl-wiktionary.jsonl.gz"), (e) => {
    if (e.lang_code !== "nl") return;
    const mapped = POS_MAP[e.pos];
    if (!mapped) return;
    const tags = e.tags ?? [];
    const word = e.word.normalize("NFC");
    const senses = (e.senses ?? [])
      .filter((s) => !(s.tags ?? []).includes("form-of"))
      .map((s, i) => ({
        index: i + 1,
        glosses: s.glosses ?? [],
        tags: s.tags ?? [],
        topics: s.topics ?? [],
        examples: (s.examples ?? []).map((x) => x.text).filter(Boolean),
      }));
    const translations = (e.translations ?? [])
      .filter((t) => t.lang_code === "en" && t.word)
      .map((t) => ({ word: t.word.normalize("NFC"), senseIndex: t.sense_index ?? null, sense: t.sense ?? null }));
    // Inflected forms are English Wiktionary's job; a record with nothing
    // but form-of senses adds nothing here.
    if (senses.length === 0) return;
    // "(meiden)" — a parenthesised alternative, not a form.
    const forms = (e.forms ?? []).filter((f) => f.form && !/[()]/.test(f.form)).flatMap((f) => cleanForms(f.form).map((form) => ({ form, tags: f.tags ?? [] })));
    const perfect = forms.filter((f) => f.tags.includes("perfect") && f.tags.includes("short-form") && f.tags.includes("present"));
    const auxiliaries = new Set(perfect.map((f) => f.form.split(" ")[0]).filter((a) => a === "hebben" || a === "zijn"));
    const record = {
      word,
      pos: mapped.pos,
      kind: mapped.kind,
      genders: gendersFromTags(tags),
      tags,
      forms,
      auxiliaries: [...auxiliaries],
      senses: senses.filter((s) => !s.tags.some((t) => EXCLUDED_SENSE_TAGS.has(t))),
      translations,
      hyphenation: e.hyphenations?.[0]?.parts,
      // "Achtervoegsel -ing in het Nederlands": the suffix the word is
      // formed with, which for some suffixes fixes the article.
      suffixes: (e.categories ?? [])
        .map((c) => c.name?.match(/^Achtervoegsel -(\p{L}+) in het Nederlands$/u)?.[1])
        .filter(Boolean),
    };
    const list = entries.get(word);
    if (list) list.push(record);
    else entries.set(word, [record]);
  });
  return { entries };
}

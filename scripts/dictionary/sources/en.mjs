/* English Wiktionary (via kaikki.org / wiktextract), Dutch entries.

   The main source: English glosses per sense, gender, plurals, verb tables,
   usage examples with translations, synonyms, and compound etymologies.

   Returns:
     entries    Map word → raw lemma entries (one per Wiktionary POS section)
     formLinks  inflected/alternative forms → their lemma ("liep" → lopen) */
import { join } from "node:path";
import { eachJsonl } from "../io.mjs";
import { CACHE_DIR } from "../paths.mjs";
import { EXCLUDED_SENSE_TAGS, POS_MAP } from "../tags.mjs";

/** "[with op ‘for’]" in a raw gloss: a fixed preposition, and what the
 *  verb + preposition means in English. */
const GOVERNS = /\[with ([\p{L}]+)(?:\s+[‘'"“]([^’'"”]+)[’'"”])?\]/u;

/** "… indicative of uitvoeren", "plural of bal": an inflection, not a meaning. */
const INFLECTION_GLOSS = /^(?:inflection of|(?:[\w/-]+ )*(?:singular|plural|participle|indicative|imperative|subjunctive|diminutive|comparative|superlative|inflected|partitive|genitive)(?: [\w/-]+)* of) ([\p{L}'-]+)$/u;

/** Digit-keyed template args, in order: the parts of a compound. */
function templateParts(t) {
  return Object.entries(t.args ?? {})
    .filter(([k]) => /^\d+$/.test(k) && k !== "1")
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, v]) => String(v).trim())
    .filter(Boolean);
}

/** Etymology: a compound's parts (with interfixes like "-s-"), and
 *  affixation (prefix/suffix) for morphemes. */
function etymologyOf(entry) {
  for (const t of entry.etymology_templates ?? []) {
    const name = t.name;
    if (["compound", "com", "com+", "af", "affix", "prefix", "pre", "suffix", "suf", "univerbation"].includes(name)) {
      const parts = templateParts(t).filter((p) => !p.startsWith("*"));
      if (parts.length >= 2) return { template: name, parts };
    }
  }
  return undefined;
}

function genderCodes(entry) {
  for (const h of entry.head_templates ?? []) {
    if (h.name === "nl-noun-dim" || h.name === "nl-noun-dim-tant") return ["n"];
    if (h.name === "nl-noun" || h.name === "nl-proper noun" || h.name === "nl-prop" || h.name === "nl-noun-adj") {
      const g = String(h.args?.["1"] ?? h.args?.g ?? "");
      return g.split(/[,\s]+/).map((x) => x.trim()[0]).filter((x) => ["m", "f", "n", "p", "c"].includes(x));
    }
  }
  return [];
}

/** The stressed headword when the headline spells it (vóórkomen). */
function stressOf(entry) {
  const accented = (f) => typeof f === "string" && /[áéíóú]/.test(f);
  for (const h of entry.head_templates ?? []) {
    if (accented(h.args?.head2)) return h.args.head2.normalize("NFC");
    if (accented(h.args?.head)) return h.args.head.normalize("NFC");
  }
  return (entry.forms ?? []).find((f) => f.tags?.includes("canonical") && accented(f.form))?.form.normalize("NFC");
}

function senseRecord(s) {
  const tags = s.tags ?? [];
  const raw = (s.raw_glosses ?? s.glosses ?? []).join(" ");
  const gov = raw.match(GOVERNS);
  return {
    id: s.id,
    glosses: s.glosses ?? [],
    rawGloss: raw,
    tags,
    topics: s.topics ?? [],
    qualifier: s.qualifier,
    governs: gov?.[1],
    governsEn: gov?.[2],
    examples: (s.examples ?? [])
      .filter((e) => e.text && (e.translation || e.english))
      .map((e) => ({ text: e.text, translation: e.translation ?? e.english, offsets: e.bold_text_offsets ?? null })),
    synonyms: (s.synonyms ?? []).map((x) => x.word).filter(Boolean),
    antonyms: (s.antonyms ?? []).map((x) => x.word).filter(Boolean),
    formOf: (s.form_of ?? []).map((x) => x.word),
    altOf: (s.alt_of ?? []).map((x) => x.word),
  };
}

export async function loadEnWiktionary() {
  const entries = new Map();
  const formLinks = []; // { form, lemma, tags, srcPos }
  const synonymOf = []; // { word, of }

  await eachJsonl(join(CACHE_DIR, "en-wiktionary-dutch.jsonl.gz"), (e) => {
    if (e.lang_code !== "nl") return;
    const mapped = POS_MAP[e.pos];
    if (!mapped) return;
    const word = e.word.normalize("NFC");
    const senses = (e.senses ?? []).map(senseRecord);

    const lemmaSenses = [];
    for (const s of senses) {
      // Some inflection senses carry no form-of tag: "first-person singular
      // dependent-clause present indicative of uitvoeren".
      const untagged = (s.glosses.join(" ").match(INFLECTION_GLOSS) ?? [])[1];
      if (untagged && !s.formOf.length) s.formOf = [untagged];
      if (s.tags.includes("form-of") || s.formOf.length) {
        for (const lemma of s.formOf) formLinks.push({ form: word, lemma: lemma.normalize("NFC"), tags: s.tags, srcPos: mapped.pos });
        continue;
      }
      const gloss = s.glosses.join(" ");
      // "synonym of X", "alternative form of X": pointers, not meanings.
      const syn = gloss.match(/^(?:synonym|alternative form|alternative spelling|obsolete spelling|archaic spelling|dated spelling) of ([^\s(]+(?:\s[^\s(]+)?)/i);
      if (syn || (s.altOf.length && !s.tags.includes("abbreviation") && !s.tags.includes("initialism") && !s.tags.includes("acronym"))) {
        const target = (syn?.[1] ?? s.altOf[0] ?? "").normalize("NFC");
        if (target && !s.tags.some((t) => EXCLUDED_SENSE_TAGS.has(t))) synonymOf.push({ word, of: target, alternative: !syn || !/^synonym/i.test(syn[0]) });
        continue;
      }
      if (s.tags.some((t) => EXCLUDED_SENSE_TAGS.has(t))) continue;
      if (!s.glosses.length) continue;
      // Surnames and given names are not vocabulary: "Steen" the surname
      // would otherwise sit next to de steen in every search.
      if (/\b(surname|given name|patronymic)\b/i.test(gloss)) continue;
      lemmaSenses.push(s);
    }

    // Forms tables are on the lemma: every inflected form points back here.
    const forms = (e.forms ?? [])
      .filter((f) => f.form && !(f.tags ?? []).some((t) => ["table-tags", "inflection-template", "class", "canonical", "romanization"].includes(t)))
      .map((f) => ({ form: f.form.normalize("NFC"), tags: f.tags ?? [] }));
    const tableTags = (e.forms ?? []).filter((f) => f.tags?.includes("table-tags")).map((f) => f.form).join(" ");

    if (lemmaSenses.length === 0) return;
    const record = {
      word,
      pos: mapped.pos,
      srcPos: e.pos,
      kind: mapped.kind,
      subtype: mapped.subtype,
      genders: genderCodes(e),
      isDiminutive: (e.head_templates ?? []).some((h) => h.name === "nl-noun-dim-tant"),
      forms,
      tableTags,
      stress: stressOf(e),
      etymology: etymologyOf(e),
      hyphenation: e.hyphenations?.[0]?.parts,
      ipa: (e.sounds ?? []).find((s) => s.ipa)?.ipa,
      senses: lemmaSenses,
    };
    const list = entries.get(word);
    if (list) list.push(record);
    else entries.set(word, [record]);
  });

  return { entries, formLinks, synonymOf };
}

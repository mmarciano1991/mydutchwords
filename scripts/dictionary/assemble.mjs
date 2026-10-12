/* Step 2–3 of the pipeline: build words, uses, forms and senses, and check
   that the sources agree.

   English Wiktionary is the base; Dutch Wiktionary checks it. A grammatical
   fact both state the same way is `verified`; one only one source states is
   `checked` (and the app says so — "Article not verified yet"); one they
   state differently goes to the doubt queue and the use is not published.

   Nothing here writes a meaning. Glosses are selected and shortened
   mechanically (condenseGloss); a gloss that is still too long is handed to
   the model step, or, without it, to the doubt queue. */
import { canonicalForm, searchKey } from "../../src/lib/dictionary/normalize.ts";
import { condenseGloss, contentWords, glossIssues } from "../../src/lib/dictionary/checks.ts";
import {
  articleFromGenders,
  domainOf,
  nounSubtype,
  pronounSubtype,
  registerOf,
  varietyOf,
  verbSubtype,
} from "./tags.mjs";
import { numeralValue } from "./numerals.mjs";

const NOISY_FORM_TAGS = ["archaic", "dated", "Flanders", "colloquial", "with-gij", "majestic", "obsolete", "subjunctive", "dialectal"];

const isClean = (f) => !f.tags.some((t) => NOISY_FORM_TAGS.includes(t));

/** The first form whose tags include all of `want` and none of `avoid`. */
function pick(forms, want, avoid = []) {
  return forms.find((f) => isClean(f) && want.every((t) => f.tags.includes(t)) && !avoid.some((t) => f.tags.includes(t)))?.form;
}

function allOf(forms, want, avoid = []) {
  return forms.filter((f) => isClean(f) && want.every((t) => f.tags.includes(t)) && !avoid.some((t) => f.tags.includes(t))).map((f) => f.form);
}

const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/** Articles as a set, for comparing two sources: de/het → {de, het}. */
const articleSet = (articles) => new Set(articles.flatMap((a) => (a === "de/het" ? ["de", "het"] : a ? [a] : [])));

/** Records that describe the same grammatical use. Nouns of one word are
 *  one use (an article that differs per meaning is a sense override: de
 *  bal / het bal); verbs split when separability or stress differs
 *  (vóórkomen / voorkómen). */
function useSignature(rec) {
  if (rec.pos === "verb") return `verb|${/separable/.test(rec.tableTags) ? "sep" : "insep"}|${rec.stress ?? ""}`;
  if (rec.kind === "properNoun") return "noun|proper";
  return rec.pos;
}

/**
 * Builds one word from its English and Dutch Wiktionary records.
 * Returns { word, doubts, abbreviations, multiwords } — `word` is null when
 * nothing about it can be published.
 */
export function assembleWord(form, enRecs, nlRecs, ctx) {
  const doubts = [];
  const doubt = (scope, reason, detail = {}) => doubts.push({ word: form, scope, reason, ...detail });
  const multiwords = []; // verb + preposition units found in raw glosses

  const uses = [];
  const groups = new Map();
  for (const rec of enRecs) {
    const sig = useSignature(rec);
    const g = groups.get(sig);
    if (g) g.push(rec);
    else groups.set(sig, [rec]);
  }

  const nlByPos = new Map();
  for (const r of nlRecs) {
    const list = nlByPos.get(r.pos);
    if (list) list.push(r);
    else nlByPos.set(r.pos, [r]);
  }

  const posCount = new Map();
  for (const recs of groups.values()) {
    const first = recs[0];
    const n = (posCount.get(first.pos) ?? 0) + 1;
    posCount.set(first.pos, n);
    const useId = n === 1 ? first.pos : `${first.pos}.${n}`;
    const nl = nlByPos.get(first.pos) ?? [];
    const homographs = [...groups.values()].filter((g) => g[0].pos === first.pos).length;
    const use = buildUse(form, useId, recs, nl, { ...ctx, homographs }, doubt, multiwords);
    if (use) uses.push(use);
  }

  // Dutch-only uses: a part of speech English Wiktionary lacks for this
  // word, with English translations of its own (huurtoeslag, zzp'er).
  for (const [pos, recs] of nlByPos) {
    if (uses.some((u) => u.pos === pos) || groups.size > 0 && enRecs.some((r) => r.pos === pos)) continue;
    const use = buildNlOnlyUse(form, pos, recs, ctx, doubt);
    if (use) uses.push(use);
  }

  if (uses.length === 0) return { word: null, doubts, multiwords };

  const kind =
    uses.some((u) => u.expansion) ? "abbreviation" :
    enRecs.some((r) => r.kind === "properNoun") && uses.every((u) => u.subtype === "proper") ? "properNoun" :
    /\s/.test(form) ? "multiword" :
    "word";

  const allChecked = uses.every((u) => u.senses.every((s) => s.meta.confidence === "verified"));
  const word = {
    id: form,
    form,
    kind,
    variants: [],
    frequency: ctx.frequency.of(form),
    searchKey: searchKey(form),
    meta: {
      sources: [...new Set(["opentaal", ...(enRecs.length ? ["en-wiktionary"] : []), ...(nlRecs.length ? ["nl-wiktionary"] : [])])],
      confidence: allChecked ? "verified" : "checked",
    },
    uses,
    // Carried for the later passes (compounds, morphemes); stripped before publishing.
    _etymology: enRecs.find((r) => r.etymology)?.etymology,
    _phonology: (() => {
      const r = enRecs.find((x) => x.ipa && x.hyphenation) ?? nlRecs.find((x) => x.hyphenation);
      return r ? { ipa: r.ipa, hyphenation: r.hyphenation } : undefined;
    })(),
  };
  return { word, doubts, multiwords };
}

function buildUse(form, useId, recs, nlRecs, ctx, doubt, multiwords) {
  const first = recs[0];
  const pos = first.pos;
  const forms = dedupeForms(recs.flatMap((r) => r.forms));
  const fieldMeta = {};
  const use = { id: useId, pos, subtype: first.subtype ?? "", forms, fieldMeta, senses: [] };
  const twoSources = nlRecs.length > 0;
  const meta = (agree) => ({
    sources: agree === "verified" ? ["en-wiktionary", "nl-wiktionary"] : ["en-wiktionary"],
    confidence: agree,
  });
  fieldMeta.pos = meta(twoSources ? "verified" : "checked");

  // Per-record article, for a sense override when it differs (het bal).
  const recArticle = new Map(recs.map((r) => [r, articleFromGenders(r.genders)]));
  const recPlural = new Map(recs.map((r) => [r, allOf(r.forms, ["plural"], ["diminutive"])[0]]));

  if (pos === "noun") {
    use.subtype = nounSubtype({ kind: first.kind, tags: first.senses[0]?.tags, genders: first.genders, isDiminutive: first.isDiminutive });
    // Agreement is checked per Wiktionary record: "de was" (laundry) and
    // "de/het was" (wax) are separate records, and Dutch Wiktionary
    // disagreeing about the wax must not take the laundry down with it.
    const nlArticles = nlRecs.map((r) => articleFromGenders(r.genders)).filter(Boolean);
    const nlSet = articleSet(nlArticles);
    const kept = [];
    for (const rec of recs) {
      const a = recArticle.get(rec);
      if (!a || nlSet.size === 0 || [...articleSet([a])].every((x) => nlSet.has(x))) kept.push(rec);
      else doubt("use", "article: sources disagree", { pos, detail: { enWiktionary: a, nlWiktionary: nlArticles, senses: rec.senses.map((x) => x.glosses.at(-1)) } });
    }
    if (!kept.length) return null;
    recs = kept;
    const enArticles = recs.map((r) => recArticle.get(r));
    const primary = enArticles.find(Boolean);
    if (primary) use.article = primary;
    if (!primary && nlArticles.length === 0) {
      fieldMeta.article = { sources: [], confidence: "checked" };
      use.articleMissing = true;
    } else if (!primary) {
      use.article = nlArticles[0];
      fieldMeta.article = { sources: ["nl-wiktionary"], confidence: "checked" };
    } else if (nlArticles.length === 0) {
      fieldMeta.article = meta("checked");
    } else {
      fieldMeta.article = meta("verified");
    }
    if (use.article === "de/het") use.articleNote = "Both de and het are used.";

    const enPlurals = new Set(recs.flatMap((r) => allOf(r.forms, ["plural"], ["diminutive"])));
    const nlPlurals = new Set(nlRecs.flatMap((r) => r.forms.filter((f) => f.tags.includes("plural") && !f.tags.includes("diminutive")).map((f) => f.form)));
    const plurals = [...enPlurals];
    if (plurals.length) {
      use.plural = recPlural.get(first) ?? plurals[0];
      const second = plurals.find((p) => p !== use.plural && recPlural.get(first) !== p && recs.length === 1);
      if (second) use.plural2 = second;
      if (nlPlurals.size === 0) fieldMeta.plural = meta("checked");
      else if (plurals.some((p) => nlPlurals.has(p))) fieldMeta.plural = meta("verified");
      else {
        doubt("use", "plural: sources disagree", { pos, detail: { enWiktionary: plurals, nlWiktionary: [...nlPlurals] } });
        return null;
      }
    }
    use.diminutive = pick(forms, ["diminutive"], ["plural"]);
  }

  if (pos === "verb") {
    const sep = /separable/.test(first.tableTags) && !/inseparable/.test(first.tableTags);
    use.separable = sep;
    use.irregular = /irregular|strong/.test(first.tableTags) || undefined;
    use.subtype = verbSubtype({ separable: sep, tags: first.senses.flatMap((s) => s.tags), word: form });
    use.present3sg = pick(forms, ["present", "singular", "third-person"], ["subordinate-clause"]);
    use.pastSg = pick(forms, ["past", "singular", "third-person"], ["subordinate-clause"]) ?? pick(forms, ["past", "singular"], ["subordinate-clause"]);
    use.pastPl = pick(forms, ["past", "plural"], ["subordinate-clause"]);
    use.participle = pick(forms, ["participle", "past"]);
    if (sep) {
      const split = pick(forms, ["first-person", "present", "singular", "main-clause"]);
      if (split && split.includes(" ")) {
        const [stem, ...rest] = split.split(" ");
        use.separableSplit = `${stem} … ${rest.join(" ")}`;
      }
    }
    if (use.irregular || use.subtype === "modal" || ["zijn", "hebben"].includes(form)) {
      const ik = pick(forms, ["first-person", "present", "singular"], ["subordinate-clause"]);
      const jij = pick(forms, ["present", "second-person", "singular"], ["subordinate-clause", "formal"]);
      const hij = use.present3sg;
      if (ik && jij && hij) use.present = [{ person: "ik", form: ik }, { person: "jij", form: jij }, { person: "hij", form: hij }];
    }
    if (first.stress) use.stress = first.stress;

    // Cross-check the principal parts against Dutch Wiktionary.
    const nlParticiples = new Set(nlRecs.flatMap((r) => r.forms.filter((f) => f.tags.includes("participle") && f.tags.includes("past")).map((f) => f.form)));
    const nlPasts = new Set(nlRecs.flatMap((r) => r.forms.filter((f) => f.tags.length === 1 && f.tags[0] === "past").map((f) => f.form)));
    for (const [field, value, nlSet] of [["participle", use.participle, nlParticiples], ["pastSg", use.pastSg, nlPasts]]) {
      if (!value) continue;
      if (nlSet.size === 0) fieldMeta[field] = meta("checked");
      else if (nlSet.has(value)) fieldMeta[field] = meta("verified");
      else if (ctx.homographs > 1) {
        // Two verbs spelled alike (vóórkomen / voorkómen) and Dutch
        // Wiktionary's records can't be paired with ours: one source.
        fieldMeta[field] = meta("checked");
      } else {
        // Several verbs share a spelling (voorkomen): agreement with any is
        // enough; with none, the forms are in doubt.
        doubt("use", `${field}: sources disagree`, { pos, detail: { enWiktionary: value, nlWiktionary: [...nlSet] } });
        return null;
      }
    }
    const aux = new Set(nlRecs.flatMap((r) => r.auxiliaries));
    if (aux.size === 2) use.auxiliary = "both";
    else if (aux.size === 1) use.auxiliary = [...aux][0];
    if (use.auxiliary) fieldMeta.auxiliary = { sources: ["nl-wiktionary"], confidence: "checked" };
  }

  if (pos === "adjective") {
    use.subtype = recs.some((r) => r.forms.length === 0 && r.senses.some((s) => s.tags.includes("invariable") || s.tags.includes("indeclinable")))
      ? "invariable"
      : "inflected";
    use.comparative = pick(forms, ["comparative"], ["inflected", "partitive"]);
    use.superlative = pick(forms, ["superlative"], ["inflected", "partitive"]);
    const nlInflected = nlRecs.flatMap((r) => r.forms.filter((f) => f.tags.includes("inflected") && f.tags.includes("positive")).map((f) => f.form));
    use.inflected = pick(forms, ["inflected"], ["comparative", "superlative"]) ?? nlInflected[0];
    if (use.inflected) fieldMeta.inflected = nlInflected.includes(use.inflected) ? meta("verified") : meta("checked");
    if (!use.inflected && use.subtype === "inflected" && /e$/.test(form) === false && form.endsWith("en")) use.subtype = "invariable";
  }

  if (pos === "pronoun") {
    const tags = recs.flatMap((r) => r.senses.flatMap((s) => s.tags));
    use.subtype = first.srcPos === "det" && tags.includes("possessive") ? "possessive" : pronounSubtype(tags);
    const person = ["first-person", "second-person", "third-person"].find((p) => tags.includes(p));
    if (person) use.person = person.replace("-person", "");
    const fn = tags.includes("possessive") ? "possessive" : tags.includes("accusative") || tags.includes("objective") ? "object" : tags.includes("nominative") || tags.includes("subjective") ? "subject" : undefined;
    if (fn) use.function = fn;
  }

  if (pos === "conjunction") {
    const glossText = recs.flatMap((r) => r.senses.flatMap((s) => [...s.tags, s.rawGloss])).join(" ").toLowerCase();
    use.subtype = /subordinat/.test(glossText) ? "subordinating" : /coordinat/.test(glossText) ? "coordinating" : "";
    if (use.subtype) use.clauseType = use.subtype;
  }

  if (pos === "numeral") {
    const value = numeralValue(form);
    if (value !== undefined) {
      use.digit = String(value.value);
      use.subtype = value.ordinal ? "ordinal" : "cardinal";
    }
  }

  if (pos === "article") {
    use.subtype = form === "een" ? "indefinite" : "definite";
    if (form === "de") use.usage = "With de-words and all plurals.";
    if (form === "het") use.usage = "With het-words and diminutives.";
  }

  if (pos === "adverb") {
    const tags = recs.flatMap((r) => r.senses.flatMap((s) => s.tags));
    if (tags.includes("pronominal")) use.subtype = "pronominal adverb";
  }

  // ── Senses ──
  let rank = 0;
  for (const rec of recs) {
    const article = recArticle.get(rec);
    const plural = recPlural.get(rec);
    for (const s of rec.senses) {
      const abbreviation = s.altOf.length > 0 && s.tags.some((t) => ["abbreviation", "initialism", "acronym"].includes(t));
      if (abbreviation && !use.expansion) {
        use.expansion = s.altOf[0].normalize("NFC");
        use.subtype = s.tags.includes("acronym") || s.tags.includes("initialism") ? "acronym" : "abbreviation";
      }
      const rawGloss = s.glosses[s.glosses.length - 1] ?? "";
      const gloss = abbreviation ? "" : condenseGloss(rawGloss);
      const sense = {
        sourceId: s.id,
        gloss,
        rawGloss,
        variety: varietyOf(s.tags),
        register: registerOf(s.tags),
        domain: domainOf(s.topics),
        rank: rank++,
        synonyms: s.synonyms,
        antonyms: s.antonyms,
        examples: [],
        _rawExamples: s.examples,
        _expansion: abbreviation ? s.altOf[0].normalize("NFC") : undefined,
        meta: { sources: ["en-wiktionary"], confidence: twoSources ? "verified" : "checked" },
      };
      if (pos === "noun" && article && use.article && article !== use.article) sense.article = article;
      if (pos === "noun" && plural && use.plural && plural !== use.plural) sense.plural = plural;
      if (s.qualifier && s.qualifier.split(/\s+/).length <= 6) sense.glossNote = s.qualifier;
      if (s.tags.includes("figuratively") && !sense.glossNote) sense.glossNote = "figurative";
      use.senses.push(sense);

      // "[with op 'for']" — a verb + preposition unit of its own.
      if (pos === "verb" && s.governs && gloss) {
        multiwords.push({
          form: `${form} ${s.governs}`,
          head: form,
          governs: s.governs,
          gloss: s.governsEn ? `${gloss} ${s.governsEn}` : gloss,
          rawGloss,
          sense,
          useForms: forms,
          separable: use.separable,
        });
      }
    }
  }

  // Two meanings shortened to the same gloss ("ball" for de bal and for the
  // dance het bal, "ball, dance party"): the later one takes its next listed
  // alternative instead — still words from its own source gloss.
  const taken = new Set();
  for (const s of use.senses) {
    if (!s.gloss) continue;
    if (taken.has(s.gloss.toLowerCase())) {
      const alt = alternativesOf(s.rawGloss).find((a) => !taken.has(a.toLowerCase()) && !glossIssues(a).length);
      if (alt) s.gloss = alt;
    }
    taken.add(s.gloss.toLowerCase());
  }

  // Doubled glosses after that are one meaning said twice: keep the first,
  // fold the second's examples and synonyms into it.
  const byGloss = new Map();
  use.senses = use.senses.filter((s) => {
    if (!s.gloss) return true;
    const key = `${s.gloss.toLowerCase()}|${s.article ?? ""}`;
    const kept = byGloss.get(key);
    if (!kept) {
      byGloss.set(key, s);
      return true;
    }
    kept._rawExamples.push(...s._rawExamples);
    kept.synonyms = [...new Set([...kept.synonyms, ...s.synonyms])];
    return false;
  });

  // nl explanation: only when both sources have exactly one meaning, so the
  // pairing can't be wrong.
  if (use.senses.length === 1 && nlRecs.length === 1 && nlRecs[0].senses.length === 1) {
    use.senses[0].explanationNl = nlRecs[0].senses[0].glosses.join(" ");
  }

  return use.senses.length ? use : null;
}

/** A use only Dutch Wiktionary has, glossed by its English translations. */
function buildNlOnlyUse(form, pos, recs, ctx, doubt) {
  const rec = recs[0];
  const use = { id: pos, pos, subtype: rec.kind === "properNoun" ? "proper" : "", forms: dedupeForms(rec.forms.filter((f) => f.tags.includes("plural") || f.tags.includes("diminutive") || f.tags.includes("past") || f.tags.includes("participle"))), fieldMeta: { pos: { sources: ["nl-wiktionary"], confidence: "checked" } }, senses: [] };
  if (pos === "noun") {
    const article = recs.map((r) => articleFromGenders(r.genders)).find(Boolean);
    if (article) {
      use.article = article;
      use.fieldMeta.article = { sources: ["nl-wiktionary"], confidence: "checked" };
    } else use.articleMissing = true;
    use.plural = rec.forms.find((f) => f.tags.includes("plural") && !f.tags.includes("diminutive"))?.form;
    if (use.plural) use.fieldMeta.plural = { sources: ["nl-wiktionary"], confidence: "checked" };
  }
  if (pos === "numeral") {
    const value = numeralValue(form);
    if (value !== undefined) {
      use.digit = String(value.value);
      use.subtype = value.ordinal ? "ordinal" : "cardinal";
    }
  }
  // Abbreviations: "burgerservicenummer" as the whole definition, tagged
  // acronym/abbreviation — the expansion.
  const abbr = rec.senses.find((s) => s.tags.some((t) => ["acronym", "abbreviation", "initialism"].includes(t)));
  if (abbr) {
    const def = abbr.glosses.join(" ").replace(/^afkorting (van|voor)\s+/i, "").trim();
    if (def && def.split(/\s+/).length <= 5) {
      use.expansion = def.replace(/\b(\p{Lu})(\p{Ll}+)/gu, (m) => (/^[A-Z][a-z]+$/.test(m) && def.split(" ").length > 1 ? m.toLowerCase() : m));
      use.subtype = "acronym";
    }
  }
  let rank = 0;
  for (const r of recs) {
    const bySense = new Map();
    for (const t of r.translations) {
      const idx = t.senseIndex ?? (r.senses.length === 1 ? 1 : null);
      if (idx === null) continue;
      // A "translation" that is the headword itself, not pinned to a sense,
      // is too weak to be the only English a word has.
      if (t.senseIndex === null && t.word.toLowerCase() === form.toLowerCase()) continue;
      if (!bySense.has(idx)) bySense.set(idx, []);
      bySense.get(idx).push(t.word);
    }
    for (const [idx, words] of bySense) {
      const nlSense = r.senses.find((s) => s.index === idx);
      if (!nlSense) continue;
      const gloss = condenseGloss(words[0]);
      use.senses.push({
        sourceId: `nl-${form}-${pos}-${idx}`,
        gloss,
        rawGloss: words.join(", "),
        explanationNl: nlSense.glosses.join(" "),
        variety: varietyOf(nlSense.tags),
        register: registerOf(nlSense.tags),
        domain: domainOf(nlSense.topics),
        rank: rank++,
        synonyms: [],
        antonyms: [],
        examples: [],
        _rawExamples: [],
        meta: { sources: ["nl-wiktionary"], confidence: "checked" },
      });
    }
  }
  if (use.expansion && use.senses.length === 0) {
    use.senses.push({
      sourceId: `nl-${form}-${pos}-abbr`,
      gloss: "",
      rawGloss: "",
      _expansion: use.expansion,
      variety: "NL",
      rank: 0,
      synonyms: [],
      antonyms: [],
      examples: [],
      _rawExamples: [],
      meta: { sources: ["nl-wiktionary"], confidence: "checked" },
    });
  }
  return use.senses.length ? use : null;
}

function dedupeForms(forms) {
  const seen = new Set();
  return forms.filter((f) => {
    const k = `${f.form}|${f.tags.join(",")}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A raw gloss's listed alternatives, each shortened: "ball, dance party"
 *  → ["ball", "dance party"]. */
function alternativesOf(raw) {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .split(/[;,]|\s+or\s+/)
    .map((p) => condenseGloss(p))
    .filter(Boolean);
}

/** Gloss check for every sense; the ones that fail are returned for the
 *  model to condense (or, without it, to the doubt queue). */
export function glossFailures(word) {
  const out = [];
  for (const use of word.uses) {
    for (const s of use.senses) {
      if (s._expansion && !s.gloss) continue; // resolved from the expansion later
      const issues = glossIssues(s.gloss);
      if (issues.length) out.push({ use, sense: s, issues });
    }
  }
  return out;
}

/** True when every content word of `short` is in `raw` — the mechanical
 *  check that a condensed gloss selected rather than invented. */
export function selectedFrom(short, raw) {
  const rawWords = new Set(contentWords(raw.replace(/[()]/g, " ")).map((w) => w.replace(/s$/, "")));
  return contentWords(short).every((w) => rawWords.has(w.replace(/s$/, "")));
}

export { canonicalForm };

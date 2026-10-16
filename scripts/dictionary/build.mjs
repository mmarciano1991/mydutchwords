/* ──────────────────────────────────────────────────────────────────────────
   The dictionary build — `npm run dictionary:build`.

     1. download sources            (download.mjs, cached)
     2. build words, uses, senses   (assemble.mjs)
     3. sources agree?              (assemble.mjs → doubt queue)
     4. an example per sense        (examples.mjs; stored examples in
                                    data/examples; model step optional)
     5. mechanical checks           (src/lib/dictionary/checks.ts)
     6. same sense?                 (llm.mjs, when ANTHROPIC_API_KEY is set)
     7. publish                     (publish.mjs → Supabase; static.mjs → shards)

   Output in OUT_DIR (.cache/dictionary-build by default):
     words.jsonl    published WordEntry records
     keys.jsonl     the search index (KeyRow)
     doubt.jsonl    everything held back, with the reason — never published
     report.json    counts, for the CI summary
     registry.json  sense-id registry (see ids.mjs)

   Flags: --words=a,b,c  build only these words (and what they need) — for
          a quick look; --no-tatoeba; --llm (requires ANTHROPIC_API_KEY).
   ────────────────────────────────────────────────────────────────────────── */
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { searchKey } from "../../src/lib/dictionary/normalize.ts";
import { contentWords, glossIssues, isCognate } from "../../src/lib/dictionary/checks.ts";
import { OUT_DIR } from "./paths.mjs";
import { loadEnWiktionary } from "./sources/en.mjs";
import { loadNlWiktionary } from "./sources/nl.mjs";
import { loadOpenTaal } from "./sources/opentaal.mjs";
import { loadFrequency, UNRANKED } from "./sources/frequency.mjs";
import { loadTatoeba } from "./sources/tatoeba.mjs";
import { assembleWord, glossFailures, selectedFrom } from "./assemble.mjs";
import { assignExamples, exampleIssues, indexTatoeba, targetForms } from "./examples.mjs";
import { GENERATED_FILE, loadStoredExamples, storedKey } from "./stored.mjs";
import { loadCondensed, loadCorrections, mergeDuplicateSenses, tier0Drop } from "./corrections.mjs";
import { assignSenseIds, loadRegistry, saveRegistry } from "./ids.mjs";
import { buildCompound, morphemesOf, stressOf } from "./morphology.mjs";

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const ONLY = args.has("words") ? new Set(String(args.get("words")).split(",").map((w) => w.normalize("NFC"))) : null;
const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

mkdirSync(OUT_DIR, { recursive: true });

log("loading sources…");
const [en, nl, opentaal, frequency, tatoebaPairs] = await Promise.all([
  loadEnWiktionary(),
  loadNlWiktionary(),
  loadOpenTaal(),
  loadFrequency(),
  args.has("no-tatoeba") ? Promise.resolve(null) : loadTatoeba(),
]);
log(`en: ${en.entries.size} words · nl: ${nl.entries.size} words · OpenTaal: ${opentaal.size} · Tatoeba: ${tatoebaPairs?.length ?? 0}`);

const doubts = [];
const report = { startedAt: new Date().toISOString(), counts: {}, doubtReasons: {}, corrections: { placeDropped: 0, merged: 0, glossFixed: 0, glossRejected: 0, dropped: 0, articleFixed: 0, exampleReplaced: 0, exampleRejected: 0, exampleRemoved: 0, unused: 0 }, examples: { wiktionary: 0, tatoeba: 0, stored: 0, storedRejected: 0, rejected: 0, none: 0, sampleRejections: [] } };

// ── 1. Official spelling ──
// A record's word must be in OpenTaal — exactly, or in another
// capitalisation ("bsn" → BSN). Multiword units: every word.
function officialForm(word) {
  if (opentaal.has(word)) return word;
  const alt = opentaal.officialForms(word);
  if (alt.length) return alt.includes(word.toLowerCase()) ? word.toLowerCase() : alt[0];
  if (/\s/.test(word) && word.split(/\s+/).every((w) => opentaal.hasAnyCase(w.replace(/[.,]$/, "")))) return word;
  return null;
}

const groups = new Map(); // official form → { en: [], nl: [], spellings: Set }
function addTo(form, source, recs, spelling) {
  if (!groups.has(form)) groups.set(form, { en: [], nl: [], spellings: new Set() });
  const g = groups.get(form);
  g[source].push(...recs);
  if (spelling !== form) g.spellings.add(spelling);
}

let notOfficial = 0;
for (const [word, recs] of en.entries) {
  const official = officialForm(word);
  if (!official) {
    notOfficial++;
    if (frequencyRankOk(word)) doubts.push({ word, scope: "word", reason: "spelling not in OpenTaal" });
    continue;
  }
  addTo(official, "en", recs, word);
}
for (const [word, recs] of nl.entries) {
  const official = officialForm(word);
  if (!official) continue;
  const hasEnglish = recs.some((r) => r.translations.length || r.senses.some((s) => s.tags.some((t) => ["acronym", "abbreviation", "initialism"].includes(t))));
  if (!groups.has(official) && !hasEnglish) continue; // Dutch-only and nothing to gloss it with
  addTo(official, "nl", recs, word);
}
log(`${groups.size} candidate words (${notOfficial} English-Wiktionary spellings not in OpenTaal)`);

/** Every doubt is logged; the frequent ones are what a reviewer sees first. */
function frequencyRankOk() {
  return true;
}
const priorityOf = (word) => (frequency.of(word) < 30000 ? "frequent" : "rare");

// --words: keep the named words plus everything they point at.
if (ONLY) {
  const keep = new Set(ONLY);
  for (const l of en.formLinks) if (ONLY.has(l.form)) keep.add(l.lemma);
  for (const w of [...keep]) for (const r of en.entries.get(w) ?? []) for (const s of r.senses) {
    for (const x of [...s.altOf, ...s.synonyms]) keep.add(x);
    if (r.etymology) for (const p of r.etymology.parts) keep.add(p.replace(/^-|-$/g, ""));
  }
  for (const k of [...groups.keys()]) if (!keep.has(k) && ![...groups.get(k).spellings].some((s) => keep.has(s))) groups.delete(k);
}

// ── 2–3. Assemble, cross-check ──
const words = new Map();
const multiwordCandidates = [];
for (const [form, g] of groups) {
  const { word, doubts: d, multiwords } = assembleWord(form, g.en, g.nl, { frequency });
  for (const x of d) if (frequencyRankOk(form)) doubts.push(x);
  if (!word) continue;
  word.variants = [...g.spellings].filter((s) => s !== form);
  words.set(form, word);
  multiwordCandidates.push(...multiwords);
}
log(`${words.size} words assembled`);

// Verb + preposition units ("wachten op") — a word of their own, unless
// Wiktionary already has the unit as a headword.
for (const m of multiwordCandidates) {
  if (words.has(m.form)) continue;
  if (!m.form.split(" ").every((w) => opentaal.hasAnyCase(w))) continue;
  const base = m.sense;
  const sense = {
    ...base,
    sourceId: `${base.sourceId}+${m.governs}`,
    gloss: m.gloss,
    rank: 0,
    _rawExamples: base._rawExamples.filter((e) => new RegExp(`\\b${m.governs}\\b`, "i").test(e.text)),
    meta: { sources: ["en-wiktionary"], confidence: base.meta.confidence },
  };
  const existing = words.get(m.form);
  if (existing) continue;
  words.set(m.form, {
    id: m.form,
    form: m.form,
    kind: "multiword",
    variants: [],
    frequency: frequency.of(m.head),
    searchKey: searchKey(m.form),
    meta: { sources: ["en-wiktionary", "opentaal"], confidence: base.meta.confidence },
    uses: [
      {
        id: "verb",
        pos: "verb",
        subtype: "verb + prep",
        pattern: m.form,
        head: m.head,
        governs: m.governs,
        headForms: m.useForms.map((f) => f.form),
        // Every form of the verb, then the preposition: "wacht op",
        // "wachtte op" — matched in a sentence with words allowed between.
        // A separable verb's split forms too: "hangt af van".
        forms: [...new Set(m.useForms.map((f) => f.form))].map((f) => ({ form: `${f} ${m.governs}`, tags: [] })),
        fieldMeta: { pos: { sources: ["en-wiktionary"], confidence: base.meta.confidence } },
        senses: [sense],
      },
    ],
  });
}

// Multiword headwords ("zin hebben") are verb units too: their head is
// the first verb, and the forms of that verb find them in a sentence.
for (const word of words.values()) {
  if (word.kind !== "multiword") continue;
  for (const use of word.uses) {
    if (use.pattern) continue;
    use.pattern = word.form;
    const parts = word.form.split(" ");
    const headWord = parts.find((p) => words.get(p)?.uses.some((u) => u.pos === "verb"));
    if (use.pos === "verb" && headWord) {
      use.head = headWord;
      const headUse = words.get(headWord).uses.find((u) => u.pos === "verb");
      const rest = parts.filter((p) => p !== headWord);
      use.subtype = use.subtype || "expression";
      // Every word order a sentence uses: "ik heb zin", "zin hebben".
      use.forms = headUse.forms.flatMap((f) => (f.form.includes(" ") ? [] : [
        { form: [f.form, ...rest].join(" "), tags: f.tags },
        { form: [...rest, f.form].join(" "), tags: f.tags },
      ]));
    }
  }
}

// "zin hebben" + a preposition the gloss names → "zin hebben in" exists as
// its own unit only when Wiktionary says so; nothing is invented here.

// ── Abbreviations: the meaning comes from the expansion's entry ──
for (const word of words.values()) {
  for (const use of word.uses) {
    for (const sense of use.senses) {
      if (!sense._expansion || sense.gloss) continue;
      const target = words.get(sense._expansion) ?? words.get(sense._expansion.toLowerCase());
      const targetSense = target?.uses[0]?.senses.find((s) => s.gloss && !glossIssues(s.gloss).length);
      if (targetSense) {
        sense.gloss = targetSense.gloss;
        sense.meta = { sources: [...new Set([...sense.meta.sources, ...targetSense.meta.sources])], confidence: "checked" };
        sense._expansionWord = target.id;
      }
    }
    if (use.expansion && !use.senses.some((s) => s.gloss)) {
      doubts.push({ word: word.form, scope: "use", pos: use.pos, reason: "abbreviation: no English meaning for its expansion", detail: { expansion: use.expansion } });
    }
  }
  if (word.uses.some((u) => u.expansion)) word.kind = "abbreviation";
}

// Alternative spellings: a spelling with no meanings of its own is a
// variant of the word it spells (paddestoel → paddenstoel).
for (const { word: alt, of, alternative } of en.synonymOf) {
  if (!alternative) continue;
  const target = words.get(of);
  if (!target || words.has(alt) || !opentaal.has(alt)) continue;
  if (!target.variants.includes(alt)) target.variants.push(alt);
}

// ── Articles by rule ──
// A noun neither Wiktionary gives an article for may still have one that
// follows from the data: an alternative spelling takes its word's article
// (blouse → de bloes), a plural (spullen, inkomsten, lui) takes de like every
// plural, a diminutive takes het, a nominalised infinitive het (het rennen),
// and a noun phrase its last noun's article (de vitale capaciteit). Marked
// "checked" with the pipeline as source and the rule named — derived, not
// stated, so the app still says "Article not verified yet".
const alternativeOf = new Map(en.synonymOf.filter((x) => x.alternative).map((x) => [x.word, x.of]));
const pluralForms = new Set(en.formLinks.filter((l) => l.tags.includes("plural") && l.srcPos === "noun").map((l) => l.form));
const DIMINUTIVES = ["etje", "tje", "pje", "kje", "je"];
/** Suffixes that fix a noun's article, by Dutch grammar (ANS): the de-word
 *  suffixes and the het-word suffixes. Only applied when Dutch Wiktionary
 *  records the word as formed with that suffix. */
const SUFFIX_ARTICLE = {
  ing: "de", heid: "de", teit: "de", iteit: "de", tie: "de", sie: "de", ij: "de", erij: "de", arij: "de",
  age: "de", itis: "de", logie: "de", ster: "de", schap: undefined,
  isme: "het", ment: "het", sel: "het",
};
const nlSuffixes = new Map();
for (const [form, recs] of nl.entries) {
  const sufs = recs.filter((r) => r.pos === "noun").flatMap((r) => r.suffixes ?? []);
  if (sufs.length) nlSuffixes.set(form, sufs);
}
function suffixArticle(form) {
  for (const suf of nlSuffixes.get(form) ?? []) {
    const article = SUFFIX_ARTICLE[suf];
    if (article && form.endsWith(suf)) return { article, rule: `suffix -${suf} takes ${article}` };
  }
  return null;
}
const nounArticleOf = (form) => words.get(form)?.uses.find((u) => u.pos === "noun" && (u.article === "de" || u.article === "het"))?.article;
for (const word of words.values()) {
  for (const use of word.uses) {
    if (use.pos !== "noun" || use.article || use.subtype === "proper") continue;
    const text = use.senses.map((s) => s.rawGloss ?? "").join(" ");
    let article;
    let rule;
    const alt = alternativeOf.get(word.form);
    if (alt && nounArticleOf(alt)) {
      article = nounArticleOf(alt);
      rule = `alternative spelling of ${alt}`;
    } else if (use.subtype === "plurale tantum" || pluralForms.has(word.form) || /\bplural(e tantum| only)\b/i.test(text)) {
      article = "de";
      rule = "plural: plurals take de";
    } else if (word.uses.some((u) => u.pos === "verb") && /en$/.test(word.form) && !word.form.includes(" ")) {
      article = "het";
      rule = "nominalised infinitive";
    } else if (DIMINUTIVES.some((suf) => word.form.endsWith(suf) && nounArticleOf(word.form.slice(0, -suf.length)))) {
      article = "het";
      rule = "diminutive";
    } else if (suffixArticle(word.form)) {
      ({ article, rule } = suffixArticle(word.form));
    } else if (word.form.includes(" ") && nounArticleOf(word.form.split(" ").at(-1))) {
      article = nounArticleOf(word.form.split(" ").at(-1));
      rule = "noun phrase: the article of its last noun";
    }
    if (article) {
      use.article = article;
      use.articleMissing = false;
      use.fieldMeta.article = { sources: ["pipeline"], confidence: "checked", rule };
    }
  }
}

// ── Articles confirmed by rule ──
// A single-source article ("checked") that the noun's ending fixes by Dutch
// grammar is as good as a second source: -heid, -ing, -teit, -tie, -logie,
// -itis, -erij take de; -isme, -ment and diminutives take het. One the rule
// contradicts stays unverified and is queued — the review looks at it.
const RULE_DE = /(heid|ing|teit|tie|logie|itis|erij)$/;
const RULE_HET = /(isme|ment|tje|pje|kje)$/;
report.articles = { confirmedByRule: 0, contradictedByRule: 0 };
for (const word of words.values()) {
  if (word.form.length < 6 || word.form.includes(" ")) continue;
  const byRule = RULE_DE.test(word.form) ? "de" : RULE_HET.test(word.form) ? "het" : null;
  if (!byRule) continue;
  for (const use of word.uses) {
    const meta = use.fieldMeta?.article;
    if (use.pos !== "noun" || !use.article || meta?.confidence === "verified" || meta?.sources?.includes("pipeline")) continue;
    if (use.article === byRule) {
      use.fieldMeta.article = { ...meta, sources: [...(meta?.sources ?? []), "rule"], confidence: "verified", rule: `ending takes ${byRule}` };
      report.articles.confirmedByRule++;
    } else if (use.article === "de" || use.article === "het") {
      report.articles.contradictedByRule++;
      if (frequencyRankOk(word.form)) doubts.push({ word: word.form, scope: "use", pos: use.pos, reason: "article: contradicts its ending", detail: { article: use.article, byRule } });
    }
  }
}
log(`articles: ${report.articles.confirmedByRule} confirmed by their ending, ${report.articles.contradictedByRule} contradict it`);

// ── Gloss rule ──
const needsCondensing = [];
for (const word of words.values()) {
  for (const f of glossFailures(word)) needsCondensing.push({ word, ...f });
}
log(`${needsCondensing.length} glosses fail the gloss rule after shortening`);

// Condensed glosses saved from an earlier model run (data/corrections/
// condensed.tsv: form, pos, source gloss, gloss), so a build doesn't pay for
// them again. The same rules as the model's own result: the gloss rule, and
// only words from the source gloss.
report.corrections.condensedApplied = 0;
{
  const saved = loadCondensed();
  for (const it of needsCondensing) {
    const gloss = saved.get(storedKey(it.word.form, it.use.pos, it.sense.rawGloss ?? ""));
    if (!gloss || glossIssues(gloss).length || !selectedFrom(gloss, it.sense.rawGloss)) continue;
    it.sense.gloss = gloss;
    it.sense.meta = { ...it.sense.meta, sources: [...new Set([...it.sense.meta.sources, "llm"])] };
    report.corrections.condensedApplied++;
  }
  log(`corrections: ${report.corrections.condensedApplied} saved condensed glosses applied`);
}

let llm = null;
// --llm         the full model step (glosses, examples, same-sense check)
// --llm=glosses only the frequent glosses still failing the gloss rule; the
//               accepted ones go to OUT_DIR/condensed.tsv, to be reviewed and
//               saved in data/corrections/condensed.tsv
const GLOSSES_ONLY = args.get("llm") === "glosses";
if (args.has("llm")) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("--llm needs ANTHROPIC_API_KEY");
  llm = await import("./llm.mjs");
  const failing = needsCondensing.filter((it) => glossIssues(it.sense.gloss ?? "").length);
  if (GLOSSES_ONLY) {
    const todo = failing.filter((it) => priorityOf(it.word.form) === "frequent");
    const before = new Map(todo.map((it) => [it, it.sense.gloss]));
    // DICTIONARY_REUSE_BATCH: read a finished batch's results instead of
    // paying again — only for the same items, so the same build.
    await llm.condenseGlosses(todo, { log, reuseBatch: process.env.DICTIONARY_REUSE_BATCH || undefined });
    const rows = todo.filter((it) => it.sense.gloss !== before.get(it) && !glossIssues(it.sense.gloss).length);
    writeFileSync(
      join(OUT_DIR, "condensed.tsv"),
      ["# form\tpos\tsource gloss\tgloss", ...rows.map((it) => [it.word.form, it.use.pos, it.sense.rawGloss, it.sense.gloss].join("\t"))].join("\n") + "\n"
    );
    log(`model: ${rows.length} condensed glosses written to condensed.tsv`);
  } else {
    // Glosses whose first alternative was kept mechanically ("entitlement,
    // benefit, allowance" → "entitlement") are a selection too: the model
    // picks the one a learner needs, from the same words.
    const alternatives = [];
    for (const word of words.values()) for (const use of word.uses) for (const sense of use.senses) {
      if (sense.rawGloss && /[,;]|\sor\s/.test(sense.rawGloss.replace(/\([^)]*\)/g, "")) && !needsCondensing.some((n) => n.sense === sense)) {
        alternatives.push({ word, use, sense, issues: [] });
      }
    }
    await llm.condenseGlosses([...failing, ...alternatives], { log });
  }
}
for (const { word, use, sense, issues } of needsCondensing) {
  if (!glossIssues(sense.gloss).length) continue; // the model fixed it
  sense._doubt = true;
  if (frequencyRankOk(word.form)) {
    doubts.push({ word: word.form, scope: "sense", pos: use.pos, reason: "gloss: too long or more than one meaning", detail: { gloss: sense.rawGloss, shortened: sense.gloss, issues } });
  }
}

// ── Corrections (corrections.mjs): Tier 0 rules, then reviewed fixes ──
const corrections = loadCorrections();
/** Correction lines that found their sense — the rest are reported. */
const usedCorrections = new Set();
for (const word of words.values()) {
  for (const use of word.uses) {
    for (const sense of use.senses) {
      if (sense._doubt || !sense.gloss) continue;
      if (tier0Drop(word, sense)) {
        sense._doubt = true;
        report.corrections.placeDropped++;
        continue;
      }
      const key = storedKey(word.form, use.pos, sense.gloss);
      if (corrections.drops.has(key)) {
        usedCorrections.add(`drop ${key}`);
        sense._doubt = true;
        report.corrections.dropped++;
        continue;
      }
      const art = corrections.articles.get(key);
      if (art && use.pos === "noun") {
        usedCorrections.add(`article ${key}`);
        // Per sense when the use's senses differ; the use's own otherwise.
        if (sense.article || use.senses.length > 1) sense.article = art.article;
        else use.article = art.article;
        use.fieldMeta.article = { sources: ["review"], confidence: "verified" };
        report.corrections.articleFixed++;
      }
      const fix = corrections.glosses.get(key);
      if (!fix) continue;
      usedCorrections.add(`gloss ${key}`);
      if (glossIssues(fix.gloss).length) {
        report.corrections.glossRejected++;
        doubts.push({ word: word.form, scope: "sense", pos: use.pos, reason: "gloss: reviewed correction failed the gloss rule", detail: { gloss: sense.gloss, proposed: fix.gloss, file: fix.file } });
        continue;
      }
      // Stored examples and corrections written for the old gloss still find it.
      sense._oldGloss = sense.gloss;
      sense.gloss = fix.gloss;
      report.corrections.glossFixed++;
    }
  }
}

// Drop held-back senses, merge duplicates, drop empty uses and empty words.
for (const [form, word] of words) {
  for (const use of word.uses) {
    use.senses = use.senses.filter((s) => !s._doubt && s.gloss);
    report.corrections.merged += mergeDuplicateSenses(use);
  }
  word.uses = word.uses.filter((u) => u.senses.length);
  if (!word.uses.length) words.delete(form);
}
log(`corrections: ${report.corrections.placeDropped} place names and ${report.corrections.dropped} reviewed senses dropped, ${report.corrections.merged} duplicates merged, ${report.corrections.glossFixed} glosses corrected (${report.corrections.glossRejected} rejected)`);

/** A per-sense lookup by the gloss as published, then by the gloss a
 *  reviewed correction replaced. */
const bySense = (map, word, use, sense) =>
  map.get(storedKey(word.form, use.pos, sense.gloss ?? "")) ?? (sense._oldGloss ? map.get(storedKey(word.form, use.pos, sense._oldGloss)) : undefined);

// ── Search index pieces needed by the checks ──
// Pure singular nouns with one article: what de/het agreement checks a
// sentence against. A form that is also any other word ("was", "bal" as a
// verb form) is left out — the sentence may not be using the noun.
const formOwners = new Map(); // lower form → Set of `${wordId}|${useId}`
function own(form, wordId, useId) {
  const k = form.toLowerCase();
  if (!formOwners.has(k)) formOwners.set(k, new Set());
  formOwners.get(k).add(`${wordId}|${useId}`);
}
for (const word of words.values()) {
  for (const use of word.uses) {
    own(word.form, word.id, use.id);
    for (const f of use.forms) own(f.form, word.id, use.id);
  }
}
for (const l of en.formLinks) own(l.form, l.lemma, l.srcPos);

const nounArticle = new Map();
for (const word of words.values()) {
  const owners = formOwners.get(word.form.toLowerCase());
  if (!owners || owners.size !== 1) continue;
  const use = word.uses[0];
  if (use.pos !== "noun" || (use.article !== "de" && use.article !== "het")) continue;
  if (use.senses.some((s) => s.article && s.article !== use.article)) continue;
  if (use.fieldMeta.article?.confidence !== "verified") continue;
  nounArticle.set(word.form.toLowerCase(), use.article);
}
const checkCtx = {
  articleOf: (t) => nounArticle.get(t),
  isKnown: (t) => opentaal.hasAnyCase(t) || formOwners.has(t.toLowerCase()),
  /** How many different words a form belongs to. */
  ownerCount: (t) => new Set([...(formOwners.get(t) ?? [])].map((x) => x.split("|")[0])).size,
};

// ── Examples ──
const tatoeba = tatoebaPairs ? indexTatoeba(tatoebaPairs) : null;
for (const word of words.values()) {
  const s = assignExamples(word, checkCtx, tatoeba);
  report.examples.wiktionary += s.wiktionary;
  report.examples.tatoeba += s.tatoeba;
  report.examples.rejected += s.rejected;
  report.examples.none += s.none;
  if (report.examples.sampleRejections.length < 25) report.examples.sampleRejections.push(...s.rejections);
}

// Stored examples (data/examples): written once for senses no corpus covers,
// checked here exactly like a corpus sentence, and only for a sense still
// without one.
const stored = loadStoredExamples(undefined, join(OUT_DIR, GENERATED_FILE));
for (const word of words.values()) {
  for (const use of word.uses) {
    for (const sense of use.senses) {
      if (sense.examples.length) continue;
      const hit = bySense(stored, word, use, sense);
      if (!hit) continue;
      const { issues, spans } = exampleIssues({ nl: hit.nl, en: hit.en }, targetForms(word, use), checkCtx);
      if (issues.length) {
        report.examples.storedRejected++;
        doubts.push({ word: word.form, scope: "example", pos: use.pos, reason: "example: stored sentence failed checks", detail: { gloss: sense.gloss, sentence: hit.nl, issues, file: hit.file } });
        continue;
      }
      sense.examples.push({ nl: hit.nl, en: hit.en, targetSpans: spans, source: "generated" });
      report.examples.stored++;
      report.examples.none--;
    }
  }
}
// An example a reviewed gloss correction left behind goes; the on-demand
// function writes one that fits.
for (const word of words.values()) {
  for (const use of word.uses) {
    for (const sense of use.senses) {
      if (!sense.examples.length || bySense(corrections.examples, word, use, sense)) continue;
      const k = storedKey(word.form, use.pos, sense.gloss ?? "");
      const old = sense._oldGloss ? storedKey(word.form, use.pos, sense._oldGloss) : null;
      if (!corrections.noExamples.has(k) && !(old && corrections.noExamples.has(old))) continue;
      usedCorrections.add(`noexample ${corrections.noExamples.has(k) ? k : old}`);
      sense.examples = [];
      report.examples.none++;
      report.corrections.exampleRemoved++;
    }
  }
}

// Reviewed example corrections replace whatever example a sense has — after
// the same checks; one that fails keeps the old example and is queued.
for (const word of words.values()) {
  for (const use of word.uses) {
    for (const sense of use.senses) {
      const fix = bySense(corrections.examples, word, use, sense);
      if (!fix) continue;
      usedCorrections.add(`example ${fix.nl}`);
      const { issues, spans } = exampleIssues({ nl: fix.nl, en: fix.en }, targetForms(word, use), checkCtx);
      if (issues.length) {
        report.corrections.exampleRejected++;
        doubts.push({ word: word.form, scope: "example", pos: use.pos, reason: "example: reviewed correction failed checks", detail: { gloss: sense.gloss, sentence: fix.nl, issues, file: fix.file } });
        continue;
      }
      if (!sense.examples.length) report.examples.none--;
      sense.examples = [{ nl: fix.nl, en: fix.en, targetSpans: spans, source: "generated" }];
      report.corrections.exampleReplaced++;
    }
  }
}
report.corrections.unused =
  corrections.drops.size + corrections.articles.size + corrections.glosses.size + corrections.noExamples.size + corrections.examples.size - usedCorrections.size;
log(`corrections: ${report.corrections.exampleReplaced} examples replaced (${report.corrections.exampleRejected} rejected), ${report.corrections.exampleRemoved} removed, ${report.corrections.articleFixed} articles corrected; ${report.corrections.unused} correction lines found no sense`);

log(`examples: ${report.examples.wiktionary} Wiktionary, ${report.examples.tatoeba} Tatoeba, ${report.examples.stored} stored (${report.examples.storedRejected} failed checks), ${report.examples.rejected} rejected by checks, ${report.examples.none} senses without`);

if (llm && !GLOSSES_ONLY) await llm.writeAndCheckExamples(words, checkCtx, { log, doubts });

// ── Compounds, morphemes, opacity ──
for (const word of words.values()) {
  const syllables = stressOf(word);
  if (syllables) word.syllables = syllables;
  if (!word._etymology) continue;
  const tree = buildCompound(word, words);
  if (tree) {
    word.compound = tree;
    if (word.kind === "word") word.kind = "compound";
    word.opaque = isOpaque(word, tree);
  }
  const morphemes = morphemesOf(word);
  if (morphemes) word.morphemes = morphemes;
}

/** Opaque: no meaning of the word shares a content word with any meaning of
 *  its head (zeehond is not a kind of hond). */
function isOpaque(word, tree) {
  let head = tree;
  while (head.right) head = head.right;
  const headWord = head.wordId && words.get(head.wordId);
  if (!headWord) return undefined;
  const headWords = new Set(headWord.uses.flatMap((u) => u.senses.flatMap((s) => contentWords(s.gloss))));
  const own = word.uses.flatMap((u) => u.senses.flatMap((s) => contentWords(s.gloss)));
  return !own.some((w) => headWords.has(w));
}

// ── Synonyms and antonyms: verified lemmas only ──
for (const word of words.values()) {
  for (const use of word.uses) {
    for (const s of use.senses) {
      s.synonyms = [...new Set(s.synonyms)].filter((x) => x !== word.form && words.has(x));
      s.antonyms = [...new Set(s.antonyms)].filter((x) => x !== word.form && words.has(x));
    }
  }
}

// ── Ranking: BE, archaic and rare senses always last ──
const isLate = (s) => s.variety === "BE" || s.register === "archaic" || s.register === "rare";
for (const word of words.values()) {
  for (const use of word.uses) {
    use.senses.sort((a, b) => Number(isLate(a)) - Number(isLate(b)) || a.rank - b.rank);
    use.senses.forEach((s, i) => (s.rank = i));
  }
}

// ── Stable ids ──
const registryPath = join(OUT_DIR, "registry.json");
const registry = loadRegistry(registryPath);
const idStats = assignSenseIds([...words.values()], registry);
if (!ONLY) saveRegistry(registryPath, registry);
log(`sense ids: ${idStats.kept} kept, ${idStats.carried} carried over, ${idStats.created} new`);

// ── Frequency of the word itself ──
// A lemma whose spelling is also a form of a very common word ("kan" of
// kunnen, "was" of zijn, "huizen" of huis) would otherwise borrow that
// word's frequency. It ranks instead by the forms only it has (kannen,
// wasje); with none, last. A competitor outside the top 1,000 doesn't
// count: "fiets" is mostly the bike, not the verb fietsen.
const ownersOf = (f) => new Set([...(formOwners.get(f.toLowerCase()) ?? [])].map((x) => x.split("|")[0]));
const COMMON_RANK = 1000;
for (const word of words.values()) {
  const owners = ownersOf(word.form);
  if (owners.size <= 1) continue;
  const rivals = [...owners].filter((id) => id !== word.id).map((id) => frequency.of(id));
  if (!rivals.some((r) => r < COMMON_RANK)) continue;
  const own = word.uses.flatMap((u) => u.forms.map((f) => f.form)).filter((f) => !f.includes(" ") && ownersOf(f).size === 1);
  word.frequency = own.length ? Math.min(...own.map((f) => frequency.of(f))) : UNRANKED;
}

// ── Search keys ──
const keys = [];
function key(text, wordId, via, useId) {
  const k = searchKey(text);
  if (!k) return;
  keys.push({ key: k, wordId, via, form: text, useId, frequency: words.get(wordId).frequency });
}
for (const word of words.values()) {
  key(word.form, word.id, "lemma");
  for (const v of word.variants) key(v, word.id, "variant");
  for (const use of word.uses) {
    // An article's "forms" are the other articles (een → de, het): not its
    // inflections.
    if (use.pos === "article") continue;
    for (const f of new Set(use.forms.map((x) => x.form))) if (f !== word.form) key(f, word.id, "form", use.id);
    if (use.expansion) key(use.expansion, word.id, "expansion", use.id);
  }
}
for (const l of en.formLinks) {
  const lemma = words.get(l.lemma);
  if (!lemma || l.form === l.lemma) continue;
  // Only into the use the form belongs to: a verb form never reaches a noun.
  const use = lemma.uses.find((u) => u.pos === l.srcPos);
  if (use) key(l.form, lemma.id, "form", use.id);
}
const uniqueKeys = new Map();
for (const k of keys) uniqueKeys.set(`${k.key}|${k.wordId}|${k.via}|${k.useId ?? ""}`, k);

// ── Publish-ready output ──
function clean(word) {
  const { _etymology, _phonology, ...rest } = word;
  void _etymology; void _phonology;
  rest.uses = rest.uses.map((u) => {
    const { headForms, articleMissing, ...use } = u;
    void headForms;
    if (articleMissing) use.fieldMeta.article = { sources: [], confidence: "checked" };
    use.senses = use.senses.map((s) => {
      const { _rawExamples, _expansion, _expansionWord, _doubt, _oldGloss, sourceId, rawGloss, ...sense } = s;
      void _rawExamples; void _expansion; void _expansionWord; void _doubt; void _oldGloss; void rawGloss; void sourceId;
      sense.cognate = isCognate(word.form, sense.gloss) || undefined;
      return sense;
    });
    return use;
  });
  return rest;
}

const wordsOut = createWriteStream(join(OUT_DIR, "words.jsonl"));
let senseCount = 0;
for (const word of words.values()) {
  const w = clean(word);
  senseCount += w.uses.reduce((n, u) => n + u.senses.length, 0);
  wordsOut.write(JSON.stringify(w) + "\n");
}
await new Promise((r) => wordsOut.end(r));
writeFileSync(join(OUT_DIR, "keys.jsonl"), [...uniqueKeys.values()].map((k) => JSON.stringify(k)).join("\n") + "\n");
writeFileSync(join(OUT_DIR, "doubt.jsonl"), doubts.map((d) => JSON.stringify({ ...d, priority: priorityOf(d.word) })).join("\n") + "\n");
for (const d of doubts) report.doubtReasons[d.reason] = (report.doubtReasons[d.reason] ?? 0) + 1;
report.counts = { words: words.size, senses: senseCount, keys: uniqueKeys.size, doubt: doubts.length, ids: idStats };
report.llm = Boolean(llm);
report.finishedAt = new Date().toISOString();
writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
log(`done: ${words.size} words, ${senseCount} senses, ${uniqueKeys.size} keys, ${doubts.length} in the doubt queue → ${OUT_DIR}`);

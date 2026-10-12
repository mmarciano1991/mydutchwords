/* Validates dictionary data — the gate before publishing, and in CI.

     node scripts/dictionary/validate.mjs            the committed test fixture
     node scripts/dictionary/validate.mjs --build    a full build in OUT_DIR

   Every published sense: not in doubt, a gloss that passes the gloss rule,
   a part of speech; every noun: an article or a declared gap; every
   example: contains its word (spans saved and pointing at it), agrees on
   de/het, spelled as OpenTaal spells it (full build only). Every key leads
   to a word. And for a full build, COVERAGE: the share of real Dutch text
   (data/coverage-corpus.txt) whose words reach an entry — the only check
   that can catch a missing word. Exits non-zero on any failure. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, ROOT } from "./paths.mjs";
import { articleIssues, findTargetSpans, glossIssues, tokenize } from "../../src/lib/dictionary/checks.ts";
import { searchKey } from "../../src/lib/dictionary/normalize.ts";

const BUILD = process.argv.includes("--build");
/** Share of corpus words that must reach an entry (full build only). */
const COVERAGE_FLOOR = 0.95;

let words, keys;
if (BUILD) {
  const read = (n) => readFileSync(join(OUT_DIR, n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  words = read("words.jsonl");
  keys = read("keys.jsonl");
} else {
  const fx = JSON.parse(readFileSync(join(ROOT, "src", "lib", "dictionary", "fixture.json"), "utf8"));
  words = fx.words;
  keys = fx.keys;
}

const failures = [];
const fail = (where, what) => failures.length < 200 && failures.push(`${where}: ${what}`);
const byId = new Map(words.map((w) => [w.id, w]));
const senseIds = new Set();

// de/het for pure singular nouns with one verified article, as the build
// checks it: a form that also belongs to another word ("was", "buren") or
// another use is left out — the sentence may not be using the noun.
const ownersByKey = new Map();
for (const k of keys) {
  const id = `${k.wordId}|${k.useId ?? ""}`;
  if (!ownersByKey.has(k.key)) ownersByKey.set(k.key, new Set());
  ownersByKey.get(k.key).add(k.wordId);
}
const nounArticle = new Map();
for (const w of words) {
  if (w.kind === "properNoun" || w.uses.length !== 1 || w.form !== w.form.toLowerCase()) continue;
  const u = w.uses[0];
  if (u.pos !== "noun" || (u.article !== "de" && u.article !== "het") || u.fieldMeta?.article?.confidence !== "verified") continue;
  if (u.senses.some((s) => s.article && s.article !== u.article)) continue;
  if ((ownersByKey.get(searchKey(w.form))?.size ?? 0) > 1) continue;
  nounArticle.set(w.form, u.article);
}

let senses = 0;
let examples = 0;
for (const w of words) {
  if (!w.uses.length) fail(w.form, "no uses");
  for (const u of w.uses) {
    if (!u.pos) fail(w.form, "use without part of speech");
    if (u.pos === "noun" && w.kind !== "properNoun" && !u.article && !u.fieldMeta?.article) fail(w.form, "noun without an article or a declared gap");
    if (!u.senses.length) fail(`${w.form} ${u.id}`, "use without senses");
    for (const s of u.senses) {
      senses++;
      if (!s.id) fail(w.form, "sense without id");
      if (senseIds.has(s.id)) fail(w.form, `duplicate sense id ${s.id}`);
      senseIds.add(s.id);
      if (s.meta?.confidence === "doubt") fail(`${w.form}: ${s.gloss}`, "published in doubt");
      const issues = glossIssues(s.gloss ?? "");
      if (issues.length) fail(`${w.form}: ${s.gloss}`, issues.join(", "));
      for (const ex of s.examples) {
        examples++;
        if (!ex.targetSpans?.length) fail(`${w.form}: ${ex.nl}`, "example without target spans");
        if (!findTargetSpans(ex.nl, [w.form, ...u.forms.map((f) => f.form), ...(u.headForms ?? [])])) fail(`${w.form}: ${ex.nl}`, "word not found in its example");
        const art = articleIssues(ex.nl, (t) => nounArticle.get(t));
        if (art.length) fail(`${w.form}: ${ex.nl}`, art.join("; "));
        if (!ex.en?.trim() && ex.source !== "captured") fail(`${w.form}: ${ex.nl}`, "example without translation");
      }
    }
  }
}
for (const k of keys) if (!byId.has(k.wordId)) fail(`key ${k.key}`, `leads to missing word ${k.wordId}`);

let coverage = null;
if (BUILD) {
  const keySet = new Set(keys.map((k) => k.key));
  const text = readFileSync(join(ROOT, "data", "coverage-corpus.txt"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .join("\n");
  const tokens = tokenize(text).filter((t) => !/^\p{N}+$/u.test(t.text) && !/^\p{Lu}/u.test(t.text.slice(1)));
  const resolved = tokens.filter((t) => keySet.has(searchKey(t.text)));
  coverage = { total: tokens.length, resolved: resolved.length, rate: resolved.length / tokens.length };
  const missing = [...new Set(tokens.filter((t) => !keySet.has(searchKey(t.text))).map((t) => t.lower))];
  if (coverage.rate < COVERAGE_FLOOR) fail("coverage", `${(coverage.rate * 100).toFixed(1)}% is below the ${COVERAGE_FLOOR * 100}% floor — missing: ${missing.slice(0, 40).join(", ")}`);
  else if (missing.length) console.log(`not reachable as whole words (compounds and names resolve at lookup): ${missing.slice(0, 30).join(", ")}${missing.length > 30 ? " …" : ""}`);
}

console.log(`${BUILD ? "build" : "fixture"}: ${words.length} words, ${senses} senses, ${examples} examples, ${keys.length} keys`);
if (coverage) console.log(`corpus coverage ${(coverage.rate * 100).toFixed(1)}% (${coverage.resolved}/${coverage.total} words, floor ${COVERAGE_FLOOR * 100}%)`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("ok");

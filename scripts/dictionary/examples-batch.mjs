/* Writing stored examples in batches (data/examples, see stored.mjs).

     node scripts/dictionary/examples-batch.mjs worklist [--count=300]
         the next senses with no example, most frequent words first, as
         numbered lines to write a sentence for (saved for `check`)
     node scripts/dictionary/examples-batch.mjs check <answers.tsv>
         answers are  n <TAB> Dutch sentence <TAB> English translation
         (or  n <TAB> -  to skip a sense whose meaning is unclear); each is
         run through the build's own checks, and what passes is appended to
         data/examples/NNNN.tsv
     node scripts/dictionary/examples-batch.mjs verify
         re-checks every stored line (after a hand edit, or a new build)
     node scripts/dictionary/examples-batch.mjs status

   Reads the published words from static shards (DICT_STATIC_DIR, default
   .cache/dictionary-static: the `w/` folder of the dictionary-latest asset)
   and OpenTaal from the download cache. */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, ROOT } from "./paths.mjs";
import { loadOpenTaal } from "./sources/opentaal.mjs";
import { exampleIssues, targetForms } from "./examples.mjs";
import { loadStoredExamples, STORED_DIR, storedKey } from "./stored.mjs";

const STATIC = process.env.DICT_STATIC_DIR ?? join(ROOT, ".cache", "dictionary-static");
const WORK = join(ROOT, ".cache", "examples-work");
const SKIPPED = join(STORED_DIR, "skipped.txt");
const [cmd, arg] = process.argv.slice(2);
const opt = (name, dflt) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt);

const words = readdirSync(join(STATIC, "w")).flatMap((f) => JSON.parse(readFileSync(join(STATIC, "w", f), "utf8")));
const stored = loadStoredExamples();
const skipped = new Set(existsSync(SKIPPED) ? readFileSync(SKIPPED, "utf8").split("\n").filter(Boolean) : []);

/** Every published sense still without an example, most frequent first. */
function open() {
  const out = [];
  for (const w of words) {
    if (w.kind === "properNoun") continue;
    for (const u of w.uses) {
      for (const s of u.senses) {
        if (s.examples.length) continue;
        const key = storedKey(w.form, u.pos, s.gloss);
        if (stored.has(key) || skipped.has(key)) continue;
        out.push({ key, w, u, s });
      }
    }
  }
  return out.sort((a, b) => a.w.frequency - b.w.frequency || a.w.form.localeCompare(b.w.form) || a.s.rank - b.s.rank);
}

/** The build's checking context, from the published words and OpenTaal. */
async function checkContext() {
  const opentaal = await loadOpenTaal();
  const owners = new Map();
  for (const w of words) for (const u of w.uses) for (const f of [w.form, ...u.forms.map((x) => x.form)]) {
    const k = f.toLowerCase();
    if (!owners.has(k)) owners.set(k, new Set());
    owners.get(k).add(w.id);
  }
  const nounArticle = new Map();
  for (const w of words) {
    const u = w.uses[0];
    if (owners.get(w.form.toLowerCase())?.size !== 1 || w.uses.length !== 1) continue;
    if (u.pos !== "noun" || (u.article !== "de" && u.article !== "het") || u.fieldMeta?.article?.confidence !== "verified") continue;
    if (u.senses.some((s) => s.article && s.article !== u.article)) continue;
    nounArticle.set(w.form.toLowerCase(), u.article);
  }
  return { articleOf: (t) => nounArticle.get(t), isKnown: (t) => opentaal.hasAnyCase(t) || owners.has(t.toLowerCase()) };
}

/** Where a stored key lands: the word and use it belongs to, or null. */
function senseOf(key) {
  const [form, pos, gloss] = key.split("\t");
  for (const w of words) {
    if (w.form !== form) continue;
    for (const u of w.uses) if (u.pos === pos && u.senses.some((s) => s.gloss === gloss)) return { w, u };
  }
  return null;
}

if (cmd === "status") {
  console.log(`stored ${stored.size} · skipped ${skipped.size} · still open ${open().length}`);
} else if (cmd === "worklist") {
  const list = open().slice(0, opt("count", 300));
  mkdirSync(WORK, { recursive: true });
  writeFileSync(join(WORK, "worklist.json"), JSON.stringify(list.map((x) => ({ key: x.key, wordId: x.w.id, useId: x.u.id }))));
  list.forEach((x, i) => {
    const article = x.u.pos === "noun" ? x.s.article ?? x.u.article : null;
    const others = x.u.senses.filter((o) => o !== x.s).map((o) => o.gloss);
    const note = x.s.glossNote ? ` — ${x.s.glossNote}` : "";
    console.log(`${i + 1}\t${article ? `${article} ` : ""}${x.w.form} (${x.u.pos})\t${x.s.gloss}${note}${others.length ? `\t≠ ${others.join("; ")}` : ""}`);
  });
} else if (cmd === "check") {
  const ctx = await checkContext();
  const byId = new Map(words.map((w) => [w.id, w]));
  const work = JSON.parse(readFileSync(join(WORK, "worklist.json"), "utf8"));
  const existing = readdirSync(STORED_DIR).filter((f) => /^\d+\.tsv$/.test(f)).length;
  const file = join(STORED_DIR, `${String(existing + 1).padStart(4, "0")}.tsv`);
  let passed = 0;
  const failed = [];
  const lines = [];
  for (const line of readFileSync(arg, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const [n, nl, en] = line.split("\t");
    const item = work[Number(n) - 1];
    if (!item) {
      failed.push(`${n}: no such line in the worklist`);
      continue;
    }
    if (nl?.trim() === "-") {
      appendFileSync(SKIPPED, `${item.key}\n`);
      continue;
    }
    const w = byId.get(item.wordId);
    const u = w.uses.find((x) => x.id === item.useId);
    const example = { nl: (nl ?? "").normalize("NFC").trim(), en: (en ?? "").normalize("NFC").trim() };
    const { issues } = exampleIssues(example, targetForms(w, u), ctx);
    if (issues.length) {
      failed.push(`${n}\t${item.key.replace(/\t/g, " | ")}\t${example.nl}\t→ ${issues.join("; ")}`);
      continue;
    }
    lines.push(`${item.key}\t${example.nl}\t${example.en}`);
    passed++;
  }
  if (lines.length) writeFileSync(file, `${lines.join("\n")}\n`);
  console.log(`${passed} passed → ${lines.length ? file.replace(`${ROOT}/`, "") : "(none)"} · ${failed.length} failed`);
  if (failed.length) console.log(failed.join("\n"));
} else if (cmd === "verify") {
  const ctx = await checkContext();
  let ok = 0;
  const bad = [];
  for (const [key, ex] of stored) {
    const hit = senseOf(key);
    if (!hit) {
      bad.push(`${ex.file}\t${key.replace(/\t/g, " | ")}\t→ no such sense in the dictionary`);
      continue;
    }
    const { issues } = exampleIssues(ex, targetForms(hit.w, hit.u), ctx);
    if (issues.length) bad.push(`${ex.file}\t${key.replace(/\t/g, " | ")}\t${ex.nl}\t→ ${issues.join("; ")}`);
    else ok++;
  }
  console.log(`${ok} ok · ${bad.length} failing`);
  if (bad.length) {
    console.log(bad.join("\n"));
    process.exit(1);
  }
} else {
  console.error("usage: examples-batch.mjs worklist [--count=N] | check <answers.tsv> | verify | status");
  process.exit(1);
}

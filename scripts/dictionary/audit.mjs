/* Counts what the dictionary is missing — examples, example translations,
   glosses, articles, parts of speech — and lists the most frequent words
   with a gap first (src/lib/dictionary/audit.ts).

     node scripts/dictionary/audit.mjs                the committed test fixture
     node scripts/dictionary/audit.mjs --build        a full build in OUT_DIR
     node scripts/dictionary/audit.mjs --static DIR   published static shards
                                                      (the dictionary-latest asset)
     node scripts/dictionary/audit.mjs --markdown     as Markdown (workflow summary)

   Writes audit.json next to a build. Never fails: a gap is published as a
   declared gap ("Example coming soon"); validate.mjs fails what is wrong. */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, ROOT } from "./paths.mjs";
import { auditDictionary, auditMarkdown } from "../../src/lib/dictionary/audit.ts";

const BUILD = process.argv.includes("--build");
const at = process.argv.indexOf("--static");
const STATIC = at === -1 ? null : process.argv[at + 1];
let words;
if (STATIC) {
  const dir = join(STATIC, "w");
  words = readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
} else if (BUILD) {
  words = readFileSync(join(OUT_DIR, "words.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
} else {
  words = JSON.parse(readFileSync(join(ROOT, "src", "lib", "dictionary", "fixture.json"), "utf8")).words;
}

const report = auditDictionary(words, { top: 40 });
if (BUILD) writeFileSync(join(OUT_DIR, "audit.json"), JSON.stringify(report, null, 2));
console.log(process.argv.includes("--markdown") ? auditMarkdown(report) : JSON.stringify(report, null, 2));

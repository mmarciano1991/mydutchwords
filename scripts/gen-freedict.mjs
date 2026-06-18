import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Inputs (cached in /tmp by earlier steps; both are GitHub-reachable if missing):
//   FreeDict nld-eng TEI:  raw.githubusercontent.com/freedict/fd-dictionaries/master/nld-eng/nld-eng.tei
//   Dutch frequency list:  raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/nl/nl_50k.txt
const TEI = "/tmp/nld-eng.tei";
const FREQ = "/tmp/nl_freq.txt";

if (!existsSync(TEI)) { console.error("Missing " + TEI + " (fetch the FreeDict TEI first)"); process.exit(1); }
if (!existsSync(FREQ)) { console.error("Missing " + FREQ + " (fetch the nl_50k frequency list first)"); process.exit(1); }

// Frequency rank: line order in the list = rank (0 = most common).
const rank = new Map();
readFileSync(FREQ, "utf8").split("\n").forEach((line, i) => {
  const w = line.split(" ")[0].toLowerCase();
  if (w && !rank.has(w)) rank.set(w, i);
});

const tei = readFileSync(TEI, "utf8");
const body = tei.slice(tei.indexOf("<body"));
const entries = body.split("<entry>").slice(1);

const dec = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/[‐‑]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

// Keep only clean, common, single-word, non-proper-noun headwords that appear in the
// frequency list. This trims the FreeDict tail (proper nouns, multi-word, archaic forms).
const isClean = (w) =>
  /^[a-zà-ÿ]/.test(w) &&        // lowercase initial → not a proper noun
  !/\s/.test(w) &&              // single word
  /^[a-zà-ÿ'’-]+$/i.test(w) &&  // letters / hyphen / apostrophe only
  w.length >= 2 &&
  rank.has(w.toLowerCase());    // actually used (in top-50k)

const seen = new Set();
const rows = [];
for (const e of entries) {
  const om = e.match(/<orth>([\s\S]*?)<\/orth>/);
  if (!om) continue;
  const dutch = dec(om[1]);
  const id = dutch.toLowerCase();
  if (seen.has(id) || !isClean(dutch)) continue;
  const trans = [...e.matchAll(/<quote>([\s\S]*?)<\/quote>/g)].map((m) => dec(m[1])).filter(Boolean);
  if (!trans.length) continue;
  const english = trans.slice(0, 2).join("; ").slice(0, 60);
  if (!english) continue;
  seen.add(id);
  rows.push([dutch, english]);
}

// Sort most-common-first so enrichment is naturally prioritised by frequency.
rows.sort((a, b) => rank.get(a[0].toLowerCase()) - rank.get(b[0].toLowerCase()));

const out =
  "// AUTO-GENERATED from FreeDict nld-eng (CC-BY-SA), trimmed to common single words\n" +
  "// (lowercase, in the Dutch top-50k frequency list) and sorted most-common-first.\n" +
  "// Regenerate with: node scripts/gen-freedict.mjs. Do not edit by hand.\n" +
  "export const GENERATED: [string, string][] = [\n" +
  rows.map(([d, e]) => "  [" + JSON.stringify(d) + ", " + JSON.stringify(e) + "],").join("\n") +
  "\n];\n";

writeFileSync("src/data/freedict.generated.ts", out);
console.log("entries written:", rows.length);

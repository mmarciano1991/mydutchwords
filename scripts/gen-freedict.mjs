import { readFileSync, writeFileSync } from "node:fs";

const tei = readFileSync("/tmp/nld-eng.tei", "utf8");
const body = tei.slice(tei.indexOf("<body"));
const entries = body.split("<entry>").slice(1);

const dec = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/[‐‑]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const seen = new Set();
const rows = [];
for (const e of entries) {
  const om = e.match(/<orth>([\s\S]*?)<\/orth>/);
  if (!om) continue;
  const dutch = dec(om[1]);
  if (!dutch || dutch.length > 40) continue;
  const id = dutch.toLowerCase();
  if (seen.has(id)) continue;
  const trans = [...e.matchAll(/<quote>([\s\S]*?)<\/quote>/g)]
    .map((m) => dec(m[1]))
    .filter(Boolean);
  if (!trans.length) continue;
  const english = trans.slice(0, 2).join("; ").slice(0, 60);
  if (!english) continue;
  seen.add(id);
  rows.push([dutch, english]);
}

const out =
  "// AUTO-GENERATED from FreeDict nld-eng (CC-BY-SA). Do not edit by hand.\n" +
  "// Dutch -> English headwords; gender/examples are layered in dictionary.ts.\n" +
  "export const GENERATED: [string, string][] = [\n" +
  rows.map(([d, e]) => "  [" + JSON.stringify(d) + ", " + JSON.stringify(e) + "],").join("\n") +
  "\n];\n";

writeFileSync("src/data/freedict.generated.ts", out);
console.log("entries written:", rows.length);

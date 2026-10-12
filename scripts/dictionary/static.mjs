/* Writes the build as static JSON shards (public/dictionary by default) —
   the dictionary for a build with no Supabase project. See
   src/lib/dictionary/staticSource.ts for how they are read. */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, ROOT } from "./paths.mjs";
import { confusionKey } from "../../src/lib/dictionary/normalize.ts";
import { previewOf } from "../../src/lib/dictionary/model.ts";

const target = process.argv[2] ?? join(ROOT, "public", "dictionary");
const readJsonl = (name) => readFileSync(join(OUT_DIR, name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const NOISY = ["archaic", "dated", "subjunctive", "with-gij", "majestic", "Flanders", "obsolete", "dialectal"];
const words = readJsonl("words.jsonl").map((w) => ({
  ...w,
  uses: w.uses.map((u) => ({ ...u, forms: u.forms.filter((f) => !f.tags.some((t) => NOISY.includes(t))) })),
}));
const keys = readJsonl("keys.jsonl");
const byId = new Map(words.map((w) => [w.id, w]));
const shardOf = (key) => key.slice(0, 2).padEnd(2, "_").replace(/[^a-z0-9]/g, "_");
const wordShardOf = (key) => key.slice(0, 3).padEnd(3, "_").replace(/[^a-z0-9]/g, "_");

rmSync(target, { recursive: true, force: true });
for (const dir of ["k", "w", "canon"]) mkdirSync(join(target, dir), { recursive: true });

// Key shards: keys, plus each referenced word's preview and the little a
// suggestion row needs — never the full entry.
const shards = new Map();
for (const k of keys) {
  const name = shardOf(k.key);
  if (!shards.has(name)) shards.set(name, { keys: [], words: new Set() });
  const s = shards.get(name);
  s.keys.push(k);
  s.words.add(k.wordId);
}
for (const [name, s] of shards) {
  const heads = {};
  for (const id of s.words) {
    const w = byId.get(id);
    if (w) heads[id] = { form: w.form, kind: w.kind, frequency: w.frequency, preview: previewOf(w) };
  }
  writeFileSync(join(target, "k", `${name}.json`), JSON.stringify({ keys: s.keys, heads }));
}

// Word shards: full entries, by the first three letters of the word's key.
const wordShards = new Map();
for (const w of words) {
  const name = wordShardOf(w.searchKey);
  if (!wordShards.has(name)) wordShards.set(name, []);
  wordShards.get(name).push(w);
}
for (const [name, list] of wordShards) writeFileSync(join(target, "w", `${name}.json`), JSON.stringify(list));

const canon = new Map();
for (const w of words) {
  const c = confusionKey(w.form);
  const name = shardOf(c).slice(0, 1);
  if (!canon.has(name)) canon.set(name, []);
  canon.get(name).push({ canon: c, wordId: w.id, form: w.form, frequency: w.frequency, searchKey: w.searchKey, preview: previewOf(w) });
}
for (const [name, rows] of canon) writeFileSync(join(target, "canon", `${name}.json`), JSON.stringify(rows));

const senses = {};
for (const w of words) for (const u of w.uses) for (const s of u.senses) senses[s.id] = w.id;
writeFileSync(join(target, "senses.json"), JSON.stringify(senses));
writeFileSync(
  join(target, "common.json"),
  JSON.stringify(
    words.filter((w) => w.kind === "word" || w.kind === "compound").sort((a, b) => a.frequency - b.frequency).slice(0, 1000)
      .map((w) => ({ wordId: w.id, form: w.form, frequency: w.frequency, preview: previewOf(w) }))
  )
);
const report = JSON.parse(readFileSync(join(OUT_DIR, "report.json"), "utf8"));
writeFileSync(join(target, "manifest.json"), JSON.stringify({ buildId: report.startedAt, words: words.length, keyShards: shards.size, wordShards: wordShards.size }));
console.log(`static: ${shards.size} shards → ${target}`);

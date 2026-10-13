/* Step 7: publish a build to Supabase.

     node scripts/dictionary/publish.mjs                  publish OUT_DIR
     node scripts/dictionary/publish.mjs --pull-registry  fetch the sense-id
                                                          registry first (run
                                                          before a build)

   Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (CI secrets). Words are
   upserted with this build's id, then every row from an older build is
   deleted — a word removed from the sources disappears, and nothing in the
   doubt queue was ever written. Learners' decks keep their local copy of a
   removed sense (see lib/wordSources), so nothing breaks for them. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR } from "./paths.mjs";
import { confusionKey } from "../../src/lib/dictionary/normalize.ts";
import { previewOf } from "../../src/lib/dictionary/model.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const db = createClient(url, key, { auth: { persistSession: false } });

const readJsonl = (name) =>
  readFileSync(join(OUT_DIR, name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

async function inChunks(rows, size, fn) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await fn(rows.slice(i, i + size));
    if (error) throw new Error(error.message);
  }
}

if (process.argv.includes("--pull-registry")) {
  const entries = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("dict_sense_registry").select("*").range(from, from + 999);
    if (error) throw new Error(error.message);
    entries.push(...data.map((r) => ({ sourceId: r.source_id, senseId: r.sense_id, wordId: r.word_id, pos: r.pos, gloss: r.gloss })));
    if (data.length < 1000) break;
  }
  writeFileSync(join(OUT_DIR, "registry.json"), JSON.stringify(entries));
  console.log(`registry: ${entries.length} entries pulled`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(join(OUT_DIR, "report.json"), "utf8"));
const buildId = report.startedAt;
const words = readJsonl("words.jsonl");
const keys = readJsonl("keys.jsonl");
const doubts = existsSync(join(OUT_DIR, "doubt.jsonl")) ? readJsonl("doubt.jsonl") : [];

// Every published sense must be complete — the last gate before the server.
for (const w of words) for (const u of w.uses) for (const s of u.senses) {
  if (!s.id || !s.gloss || !u.pos || s.meta.confidence === "doubt") throw new Error(`incomplete sense in ${w.form}`);
}

console.log(`publishing build ${buildId}: ${words.length} words, ${keys.length} keys`);
await inChunks(
  words.map((w) => ({
    id: w.id, form: w.form, kind: w.kind, search_key: w.searchKey, canon_key: confusionKey(w.form),
    frequency: w.frequency, preview: previewOf(w), data: w, build_id: buildId, updated_at: new Date().toISOString(),
  })),
  500,
  (rows) => db.from("dict_words").upsert(rows)
);
await inChunks(
  keys.map((k) => ({ key: k.key, word_id: k.wordId, via: k.via, form: k.form, use_id: k.useId ?? "", frequency: k.frequency })),
  2000,
  (rows) => db.from("dict_keys").upsert(rows, { ignoreDuplicates: true })
);
await inChunks(
  words.flatMap((w) => w.uses.flatMap((u) => u.senses.map((s) => ({ id: s.id, word_id: w.id, use_id: u.id, pos: u.pos, gloss: s.gloss, rank: s.rank })))),
  2000,
  (rows) => db.from("dict_senses").upsert(rows)
);
// Rows from older builds: gone from the sources, or now in doubt. Found by
// paging the primary key, not by filtering on build_id: that column has no
// index, and on a table every publish rewrites the filter hit the statement
// timeout.
{
  const current = new Set(words.map((w) => w.id));
  const stale = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("dict_words").select("id").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data) if (!current.has(row.id)) stale.push(row.id);
    if (data.length < 1000) break;
  }
  console.log(`removing ${stale.length} words no longer published`);
  await inChunks(stale, 200, (ids) => db.from("dict_words").delete().in("id", ids));
}
const registry = JSON.parse(readFileSync(join(OUT_DIR, "registry.json"), "utf8"));
await inChunks(
  registry.map((e) => ({ source_id: e.sourceId, sense_id: e.senseId, word_id: e.wordId, pos: e.pos, gloss: e.gloss })),
  2000,
  (rows) => db.from("dict_sense_registry").upsert(rows)
);
await inChunks(
  doubts.map((d) => ({ build_id: buildId, word: d.word, scope: d.scope, pos: d.pos ?? null, reason: d.reason, detail: d.detail ?? null })),
  2000,
  (rows) => db.from("dict_doubt").insert(rows)
);
{
  const { error } = await db.from("dict_builds").upsert({ id: buildId, report });
  if (error) throw new Error(error.message);
}
console.log("published");

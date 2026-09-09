/* Moves reviewed proposals out of the queue and into the authored data.
 *
 *   npm run promote            # dry run — shows what would move
 *   npm run promote -- --write
 *
 * This is the ONLY path from scripts/complete-entries.mjs into the shipped
 * dictionary, and it moves exactly the items a person has marked
 * `"approved": true`. Anything still false stays in the queue.
 *
 * Where each kind lands:
 *
 *   article  data/curated.ts — the word's own gender is corrected in place,
 *            and its example filled in if it had none.
 *   loose    data/curated.ts — the example sentence is replaced.
 *   example  src/data/senses.ts — a provisional meaning (split out of a
 *            packed gloss) becomes a reviewed sense with its own sentence,
 *            which is what promotes it out of "provisional".
 *
 * Everything written carries `source: "generated"`, so the app can tell a
 * learner where the sentence came from (see components/SourceNote).
 *
 * Re-running is safe: promoted items are removed from the queue, so nothing
 * is applied twice.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const QUEUE_PATH = "data/generated/pending.json";
const CURATED_PATH = "data/curated.ts";
const SENSES_PATH = "src/data/senses.ts";

const WRITE = process.argv.includes("--write");

if (!existsSync(QUEUE_PATH)) {
  console.error(`no queue at ${QUEUE_PATH} — run \`npm run complete\` first`);
  process.exit(1);
}

const queue = JSON.parse(readFileSync(QUEUE_PATH, "utf8"));
const approved = queue.filter((q) => q.approved === true);
const waiting = queue.filter((q) => q.approved !== true);

console.log(`queue          ${queue.length}`);
console.log(`approved       ${approved.length}`);
console.log(`still waiting  ${waiting.length}\n`);

if (approved.length === 0) {
  console.log('nothing approved yet — set "approved": true on the items you have checked');
  process.exit(0);
}

/** Escapes a string for a TypeScript double-quoted literal. Deliberately
 *  strict: a stray quote or backslash here would produce a file that doesn't
 *  parse, and the delimiter characters would corrupt the generated encoding
 *  downstream (see scripts/gen-dictionary.mjs). */
function literal(value) {
  if (/[\t\n\r]/.test(value)) throw new Error(`value contains a tab or newline: ${value}`);
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

let curated = readFileSync(CURATED_PATH, "utf8");
const applied = [];
const failed = [];

/* ── article + loose: edit the curated entry in place ───────────────────── */

for (const item of approved.filter((q) => q.kind === "article" || q.kind === "loose")) {
  const pattern = new RegExp(
    `\\{ dutch: "${item.dutch.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}", english: "([^"]*)", gender: ("[^"]*"|null), example: "([^"]*)", exampleEn: "([^"]*)" \\}`
  );
  const match = curated.match(pattern);
  if (!match) {
    failed.push(`${item.dutch}: no matching entry in ${CURATED_PATH}`);
    continue;
  }
  const english = match[1];
  const gender = item.kind === "article" ? item.article : match[2].replace(/"/g, "");
  const example = literal(item.example);
  const exampleEn = literal(item.exampleEn);
  const replacement = `{ dutch: "${item.dutch}", english: "${english}", gender: "${gender}", example: "${example}", exampleEn: "${exampleEn}" }`;
  curated = curated.replace(pattern, replacement);
  applied.push(item);
}

/* ── example: promote a provisional meaning into the authored overlay ───── */

const senses = readFileSync(SENSES_PATH, "utf8");
const newSenses = [];
for (const item of approved.filter((q) => q.kind === "example")) {
  if (senses.includes(`  ${item.dutch}: [`)) {
    failed.push(`${item.dutch}: already has an authored sense — merge it by hand`);
    continue;
  }
  newSenses.push(
    `  ${/^[a-z][a-z0-9]*$/i.test(item.dutch) ? item.dutch : JSON.stringify(item.dutch)}: [\n` +
      `    {\n` +
      `      english: "${literal(item.gloss)}",\n` +
      `      example: "${literal(item.example)}",\n` +
      `      exampleEn: "${literal(item.exampleEn)}",\n` +
      `      gender: "${item.article}",\n` +
      `      source: "generated",\n` +
      `    },\n` +
      `  ],`
  );
  applied.push(item);
}

if (failed.length) {
  console.log("could not apply:");
  for (const f of failed) console.log(`  ${f}`);
  console.log("");
}

console.log(`would apply    ${applied.length}`);
for (const a of applied.slice(0, 12)) {
  console.log(`  ${a.kind.padEnd(8)} ${a.dutch.padEnd(20)} "${a.example}"`);
}

if (!WRITE) {
  console.log("\nDRY RUN — nothing written. Re-run with --write to apply.");
  process.exit(0);
}

writeFileSync(CURATED_PATH, curated);

if (newSenses.length) {
  const marker = "const EXTRA_SENSES: Record<string, WordSense[]> = {";
  const at = senses.indexOf(marker);
  if (at === -1) throw new Error(`could not find EXTRA_SENSES in ${SENSES_PATH}`);
  const insertAt = at + marker.length;
  writeFileSync(SENSES_PATH, `${senses.slice(0, insertAt)}\n${newSenses.join("\n")}${senses.slice(insertAt)}`);
}

// Only the items that actually landed leave the queue.
const appliedKeys = new Set(applied.map((a) => `${a.kind}:${a.dutch}:${a.senseIndex}`));
const remaining = queue.filter((q) => !appliedKeys.has(`${q.kind}:${q.dutch}:${q.senseIndex}`));
writeFileSync(QUEUE_PATH, `${JSON.stringify(remaining, null, 2)}\n`);

console.log(`\napplied ${applied.length}; ${remaining.length} left in the queue`);
console.log("next: npm run dictionary && npm run validate");

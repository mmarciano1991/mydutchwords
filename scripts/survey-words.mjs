/* Attaches English glosses to a list of words exported from Supabase.
 *
 * The database stores a deck as dictionary ids, and for bundled words that id
 * *is* the Dutch word — so `select * from survey_candidates` already tells you
 * which words to test, but not what they mean. The glosses live in the app
 * bundle (14k of them; see scripts/gen-dictionary.mjs), not in Postgres, so
 * this script joins the two:
 *
 *   node scripts/survey-words.mjs candidates.csv > survey.csv
 *   npm run survey -- candidates.csv survey.csv
 *
 * Input is either the CSV you download from the Supabase SQL Editor (any
 * columns, as long as one is `dutch` or `word_id`) or a plain list of words,
 * one per line. Output is the same rows with english / gender / example /
 * exampleEn filled in — ready to paste into a survey builder.
 *
 * Rows that already carry an English gloss (words the user added themselves,
 * which sync their own translation) are left alone.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ENRICHED = ["english", "gender", "example", "exampleEn"];
const GENDER = { d: "de", h: "het" };

/* ── the bundled dictionary ────────────────────────────────────────────── */

/** The payload of a `export const NAME = "…";` line in a generated module.
 *  Matched as a whole line: JSON.stringify never emits a raw newline, so the
 *  literal cannot span one, and anchoring avoids tripping over an escaped
 *  quote inside the data. */
function generatedString(file, exportName) {
  const src = readFileSync(file, "utf8");
  const match = src.match(new RegExp(`^export const ${exportName} = ("[^\\n]*");$`, "m"));
  if (!match) {
    throw new Error(`${file} has no single-line \`export const ${exportName} = "…";\` — regenerate it with \`npm run dictionary\``);
  }
  return JSON.parse(match[1]);
}

function loadDictionary() {
  const core = generatedString("src/data/core.generated.ts", "CORE").split("\n");
  const examples = generatedString("src/data/examples.generated.ts", "EXAMPLES").split("\n");

  const byId = new Map();
  core.forEach((line, i) => {
    const [dutch, english, genderCode] = line.split("\t");
    const [example = "", exampleEn = ""] = (examples[i] ?? "").split("\t");
    // Curated words come first and win: FreeDict may repeat one with a
    // thinner gloss and no example sentence.
    const id = dutch.toLowerCase();
    if (!byId.has(id)) {
      byId.set(id, { english, gender: GENDER[genderCode] ?? "", example, exampleEn });
    }
  });
  return byId;
}

/* ── CSV ───────────────────────────────────────────────────────────────── */

/** RFC 4180 parse — quoted fields may contain commas, newlines and "" escapes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') (field += '"'), i++;
      else quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toCsv(rows) {
  const cell = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map((v) => cell(v ?? "")).join(",")).join("\n") + "\n";
}

/* ── input shapes ──────────────────────────────────────────────────────── */

const WORD_COLUMNS = ["dutch", "word_id"];

/** Normalizes either input shape to { header, rows, wordAt }. A file whose
 *  first line names no word column is read as a plain one-word-per-line list. */
function readInput(text) {
  const rows = parseCsv(text).filter((r) => r.some((v) => v.trim() !== ""));
  if (!rows.length) throw new Error("input is empty");

  const header = rows[0].map((h) => h.trim());
  const wordAt = header.findIndex((h) => WORD_COLUMNS.includes(h.toLowerCase()));
  if (wordAt !== -1) return { header, rows: rows.slice(1), wordAt };

  if (header.length > 1) {
    throw new Error(
      `no word column: expected one named ${WORD_COLUMNS.join(" or ")}, found ${header.join(", ")}`
    );
  }
  return { header: ["dutch"], rows, wordAt: 0 };
}

/* ── main ──────────────────────────────────────────────────────────────── */

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath) {
  console.error("usage: node scripts/survey-words.mjs <candidates.csv> [survey.csv]");
  process.exit(1);
}

// A missing file or an unrecognised header is a usage mistake, not a bug —
// report it as one line rather than a stack trace.
let dictionary;
let input;
try {
  dictionary = loadDictionary();
  input = readInput(readFileSync(inputPath, "utf8"));
} catch (err) {
  console.error(`survey-words: ${err.message}`);
  process.exit(1);
}
const { header, rows, wordAt } = input;

// Reuse the input's own columns where they exist, so re-running the script is
// idempotent instead of appending a second set of english/gender/… columns.
const columnAt = new Map(ENRICHED.map((name) => [name, header.indexOf(name)]));
const outHeader = [...header];
for (const name of ENRICHED) {
  if (columnAt.get(name) === -1) {
    columnAt.set(name, outHeader.length);
    outHeader.push(name);
  }
}

let matched = 0;
const missing = [];
const outRows = rows.map((row) => {
  const out = [...row];
  while (out.length < outHeader.length) out.push("");

  const word = (out[wordAt] ?? "").trim();
  const entry = dictionary.get(word.toLowerCase());
  if (entry) matched++;
  else if (word) missing.push(word);

  for (const name of ENRICHED) {
    const at = columnAt.get(name);
    // Keep whatever the export already carried — user-added words bring their
    // own translation, and the bundled dictionary has never heard of them.
    if ((out[at] ?? "").trim() === "") out[at] = entry?.[name] ?? "";
  }
  return out;
});

const csv = toCsv([outHeader, ...outRows]);
if (outputPath) writeFileSync(outputPath, csv);
else process.stdout.write(csv);

console.error(`words in       ${rows.length}`);
console.error(`glossed        ${matched}`);
if (missing.length) {
  const shown = missing.slice(0, 10).join(", ");
  console.error(`not in dictionary ${missing.length} (${shown}${missing.length > 10 ? ", …" : ""})`);
  console.error("  — user-added words keep the translation from their own CSV column.");
}

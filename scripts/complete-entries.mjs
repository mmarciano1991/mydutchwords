/* Proposes the content that's missing from the dictionary, and refuses to
 * ship any of it unreviewed.
 *
 *   npm run complete -- --kind=article --limit=20          # dry run, free
 *   npm run complete -- --kind=article --limit=20 --run    # calls the API
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * After the schema change, the dictionary can finally SAY what it's missing:
 * 80 words whose article was never established, ~1,800 meanings split out of
 * a packed gloss with no example sentence of their own, and ~870 examples
 * that don't visibly use the word they illustrate. That's roughly 2,750 gaps
 * — too many to write by hand (the authoring pass "is never done", as
 * docs/recommendations.md put it) and exactly the shape a model is good at.
 *
 * ── Why it writes to a queue and not to the dictionary ────────────────────
 * The single worst failure this app has had was a wrong meaning that arrived
 * looking exactly like a right one: "aanslag" glossed as an assassination on
 * a letter about a tax bill (docs/studies/run-04-795d03e.md). A generator
 * pointed straight at the dictionary would reproduce that failure at a scale
 * no one could audit — trading "missing information" for "confident
 * misinformation", which is strictly worse for a learner who cannot yet tell
 * the difference.
 *
 * So there are two gates, and neither is optional:
 *
 *   1. MECHANICAL. Every proposal is checked against the same rules
 *      scripts/validate-dictionary.mjs enforces — the article has to be a
 *      real one, the example has to actually use an inflected form of its own
 *      headword (checked through lib/deinflect, not substring matching), the
 *      gloss has to be a single meaning. Anything that fails is dropped here
 *      and never reaches a human.
 *   2. HUMAN. What survives is written to data/generated/pending.json with
 *      `approved: false`. Nothing enters the shipped dictionary until a
 *      person flips that flag and runs `npm run promote`.
 *
 * Everything that ships this way is marked `source: "generated"`, so the app
 * can tell the learner where the sentence came from.
 *
 * ── Cost ──────────────────────────────────────────────────────────────────
 * Calling the API costs money, so this script does NOT call it unless you
 * pass --run. Without that flag it prints exactly which words it would ask
 * about and stops.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const QUEUE_PATH = "data/generated/pending.json";
const MODEL = "claude-opus-5";

/** Words per request. Large enough to amortise the prompt, small enough that
 *  one bad batch is cheap to discard. */
const BATCH_SIZE = 20;

/* ── arguments ──────────────────────────────────────────────────────────── */

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);
const KIND = args.get("kind") ?? "article";
const LIMIT = Number(args.get("limit") ?? 20);
const RUN = args.get("run") === "true";

const KINDS = ["article", "example", "loose"];
if (!KINDS.includes(KIND)) {
  console.error(`--kind must be one of: ${KINDS.join(", ")}`);
  process.exit(1);
}

/* ── loading ────────────────────────────────────────────────────────────── */

async function loadTs(entry, tmp, name) {
  const out = join(tmp, `${name}.mjs`);
  execFileSync("npx", ["esbuild", entry, "--bundle", "--format=esm", `--outfile=${out}`, "--log-level=error"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return import(`file://${out}`);
}

/* ── finding the gaps ───────────────────────────────────────────────────── */

/** Words shipped with an article nobody established. */
function articleGaps(dictionary) {
  const out = [];
  for (const e of dictionary) {
    if (e.senses.some((s) => s.gender === "unknown")) {
      out.push({ kind: "article", dutch: e.dutch, gloss: e.english, senseIndex: 0 });
    }
  }
  return out;
}

/** Meanings split out of a packed gloss, with no example of their own. */
function exampleGaps(dictionary) {
  const out = [];
  for (const e of dictionary) {
    e.senses.forEach((s, i) => {
      if (s.provisional && !s.example) {
        out.push({ kind: "example", dutch: e.dutch, gloss: s.english, senseIndex: i });
      }
    });
  }
  return out;
}

/** Curated examples that don't visibly use the word they illustrate. */
function looseGaps(entries, deinflect, prefixes, isWord) {
  const out = [];
  for (const e of entries) {
    const sentence = String(e.example ?? "").toLowerCase();
    if (!sentence) continue;
    const id = String(e.dutch).toLowerCase();
    const tokens = sentence.match(/[a-zà-ÿ']+/g) ?? [];
    const matchesLemma = (lemma) =>
      tokens.some((t) => t === lemma || deinflect(t, (c) => c === lemma).length > 0);
    if (tokens.includes(id) || matchesLemma(id)) continue;
    const prefix = prefixes.find((p) => id.startsWith(p) && isWord(id.slice(p.length)));
    if (prefix && tokens.includes(prefix) && matchesLemma(id.slice(prefix.length))) continue;
    out.push({ kind: "loose", dutch: e.dutch, gloss: e.english, senseIndex: 0, current: e.example });
  }
  return out;
}

/* ── the request ────────────────────────────────────────────────────────── */

const SYSTEM = `You are a Dutch lexicographer completing entries in a Dutch→English vocabulary app for adult learners living in the Netherlands. Its users read municipal letters, rental contracts and news.

Rules, in order of importance:

1. Never guess. If you are not confident about a word's article or meaning, set "confident" to false for that item and leave the other fields empty. A missing entry costs a learner a lookup; a wrong one teaches them something false, which is far worse.
2. The example sentence must be natural, everyday Dutch that an adult would actually say or read, 4-12 words, and it MUST contain the headword (any inflected form is fine).
3. The example must demonstrate the SPECIFIC meaning given in "gloss", not another meaning of the same word.
4. "article" is "de" or "het" for nouns, and "none" for anything that is not a noun (verbs, adjectives, adverbs, prepositions, pronouns).
5. "exampleEn" is a natural English translation of your Dutch sentence, not a word-for-word gloss.
6. Never use a tab or newline character inside any field.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dutch: { type: "string" },
          confident: { type: "boolean" },
          article: { type: "string", enum: ["de", "het", "none", ""] },
          example: { type: "string" },
          exampleEn: { type: "string" },
          note: { type: "string" },
        },
        required: ["dutch", "confident", "article", "example", "exampleEn", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

function promptFor(kind, batch) {
  const lines = batch.map((g) =>
    g.current
      ? `- ${g.dutch} — meaning: "${g.gloss}" — current example (does NOT use the word, replace it): "${g.current}"`
      : `- ${g.dutch} — meaning: "${g.gloss}"`
  );
  const task =
    kind === "article"
      ? "For each word below, give its article and one example sentence."
      : kind === "example"
        ? "For each word below, write one example sentence demonstrating THAT SPECIFIC meaning, and give the article."
        : "For each word below, write a REPLACEMENT example sentence that actually contains the word, and give the article.";
  return `${task}\n\n${lines.join("\n")}`;
}

/* ── validation ─────────────────────────────────────────────────────────
   The mechanical gate lives in src/lib/proposalCheck.ts, not here: it needs
   the app's own morphology to decide whether a sentence uses its word, and
   keeping it in the source tree is what lets it be unit-tested
   (src/lib/proposalCheck.test.ts). The gate that runs is the gate that's
   covered. */

/* ── main ───────────────────────────────────────────────────────────────── */

const tmp = mkdtempSync(join(tmpdir(), "woordkast-complete-"));
let gaps;
let deinflect;
let checkProposal;
try {
  const { DICTIONARY } = await loadTs("src/data/dictionary.ts", tmp, "dictionary");
  const { ENTRIES } = await loadTs("data/curated.ts", tmp, "curated");
  ({ deinflect } = await loadTs("src/lib/deinflect.ts", tmp, "deinflect"));
  ({ checkProposal } = await loadTs("src/lib/proposalCheck.ts", tmp, "proposalCheck"));
  const { SEPARABLE_PREFIXES } = await loadTs("src/data/irregularForms.ts", tmp, "irregular");
  const words = new Set(ENTRIES.map((e) => String(e.dutch).toLowerCase()));

  gaps =
    KIND === "article"
      ? articleGaps(DICTIONARY)
      : KIND === "example"
        ? exampleGaps(DICTIONARY)
        : looseGaps(ENTRIES, deinflect, SEPARABLE_PREFIXES, (t) => words.has(t));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// Don't re-ask about anything already waiting for review.
const queue = existsSync(QUEUE_PATH) ? JSON.parse(readFileSync(QUEUE_PATH, "utf8")) : [];
const queued = new Set(queue.map((q) => `${q.kind}:${q.dutch}:${q.senseIndex}`));
const todo = gaps.filter((g) => !queued.has(`${g.kind}:${g.dutch}:${g.senseIndex}`)).slice(0, LIMIT);

console.log(`gap kind        ${KIND}`);
console.log(`total gaps      ${gaps.length.toLocaleString()}`);
console.log(`already queued  ${queue.length.toLocaleString()}`);
console.log(`this run        ${todo.length.toLocaleString()}\n`);

if (todo.length === 0) {
  console.log("nothing to do");
  process.exit(0);
}

if (!RUN) {
  console.log("DRY RUN — no API call, nothing spent. Words that would be sent:\n");
  for (const g of todo) console.log(`  ${g.dutch.padEnd(24)} ${g.gloss}`);
  console.log(`\nRe-run with --run to actually ask the model.`);
  process.exit(0);
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic();

const accepted = [];
const rejected = [];

for (let i = 0; i < todo.length; i += BATCH_SIZE) {
  const batch = todo.slice(i, i + BATCH_SIZE);
  process.stderr.write(`asking about ${batch.length} words (${i + batch.length}/${todo.length})…\n`);

  let items;
  try {
    // Streamed: adaptive thinking plus a large max_tokens can outrun the
    // default HTTP timeout on a full batch.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: promptFor(KIND, batch) }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      console.error(`  batch refused (${message.stop_details?.category ?? "unknown"}) — skipped`);
      continue;
    }
    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    ({ items } = JSON.parse(text));
  } catch (err) {
    console.error(`  batch failed: ${err.message} — skipped`);
    continue;
  }

  const byWord = new Map((items ?? []).map((it) => [String(it.dutch).toLowerCase(), it]));
  for (const gap of batch) {
    const item = byWord.get(gap.dutch.toLowerCase());
    if (!item) {
      rejected.push({ ...gap, problems: ["model returned nothing for this word"] });
      continue;
    }
    const problems = checkProposal(item, { dutch: gap.dutch, gloss: gap.gloss });
    if (problems.length) {
      rejected.push({ ...gap, problems, proposal: item });
      continue;
    }
    accepted.push({
      kind: gap.kind,
      dutch: gap.dutch,
      senseIndex: gap.senseIndex,
      gloss: gap.gloss,
      article: item.article,
      example: item.example.trim(),
      exampleEn: item.exampleEn.trim(),
      note: String(item.note ?? "").trim(),
      model: MODEL,
      proposedAt: new Date().toISOString(),
      // The gate that keeps generated content out of the app. Flip it by
      // hand, per item, then run `npm run promote`.
      approved: false,
    });
  }
}

mkdirSync(dirname(QUEUE_PATH), { recursive: true });
writeFileSync(QUEUE_PATH, `${JSON.stringify([...queue, ...accepted], null, 2)}\n`);

console.log(`\naccepted (queued for review) ${accepted.length}`);
console.log(`rejected by the checks       ${rejected.length}`);
for (const r of rejected.slice(0, 10)) {
  console.log(`  ${r.dutch.padEnd(20)} ${r.problems.join("; ")}`);
}
console.log(`\nreview ${QUEUE_PATH}, set "approved": true on what's right, then: npm run promote`);

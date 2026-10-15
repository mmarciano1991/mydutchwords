/* The quality review — every published sense's gloss and example, checked
   by a model, cheapest first; fixes proposed as reviewed corrections
   (corrections.mjs), never written to the dictionary directly.

     node scripts/dictionary/review.mjs --static=DIR [--limit=N] [--pilot] [--dry]

   DIR is a static dictionary (static.mjs output, the "dictionary-latest"
   release). Needs ANTHROPIC_API_KEY unless --dry.

   Tier 1  claude-haiku-5-5 reads 25 senses per request (gloss, the word's
           other meanings, the example) and only says ok or what is wrong.
   Tier 2  claude-sonnet-5-5, for flagged senses only, confirms the problem
           and proposes the smallest fix: a gloss, an example, or dropping
           the sense.
   Check   a new gloss must pass the gloss rule, a new example the cheap
           checks (supabase/functions/example/check.ts) and a second model's
           same-meaning check. The build checks again (spelling, de/het).

   Everything goes through the Message Batches API (half price). Results are
   kept in data/review/*.jsonl with a hash of what was checked: a rerun skips
   every sense already reviewed in its current form, so nothing is paid for
   twice. Proposed fixes go to data/corrections/*-review.tsv, and a report to
   data/review/report.md — a person reads it before the branch is merged.

   Order: suspicious glosses, then Tatoeba examples on words with several
   meanings, then stored examples, then the rest — each by word frequency.
   --pilot takes a sample of every kind instead, to measure before a full
   run. */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glossIssues } from "../../src/lib/dictionary/checks.ts";
import { issuesOf } from "../../supabase/functions/example/check.ts";
import { CORRECTIONS_DIR } from "./corrections.mjs";
import { ROOT } from "./paths.mjs";
import { storedKey } from "./stored.mjs";

export const TRIAGE_MODEL = "claude-haiku-5-5";
export const FIX_MODEL = "claude-sonnet-5-5";
export const CHECK_MODEL = "claude-haiku-5-5";
const GROUP = 25;
/** $ per million tokens, input / output, before the 50% batch discount. */
export const PRICES = { "claude-haiku-5-5": [0.1, 0.5], "claude-sonnet-5-5": [2, 10] };

const REVIEW_DIR = join(ROOT, "data", "review");
export const PROBLEMS = ["bad-gloss", "place-name", "offensive", "duplicate", "wrong-meaning", "ungrammatical", "unnatural", "bad-translation"];

/** Glosses that are a fragment of a definition, not a translation ("of",
 *  "act", "someone") — for parts of speech where they can't be the meaning. */
const FRAGMENTS = new Set(["of", "in", "to", "someone", "something", "its", "including", "etc", "by analogy", "less commonly", "hence metaphorically", "in particular", "one's", "pertaining"]);
const FRAGMENT_OK_POS = new Set(["preposition", "pronoun", "adverb", "article", "conjunction", "numeral", "interjection"]);

// ── Items ──

/** Every published sense as a review item, with its priority category. */
export function itemsOf(words) {
  const items = [];
  for (const w of words) {
    if (w.kind === "properNoun") continue;
    for (const u of w.uses) {
      for (const s of u.senses) {
        const ex = s.examples?.[0];
        const others = u.senses.filter((o) => o !== s).map((o) => o.gloss).slice(0, 8);
        const fragment = FRAGMENTS.has(s.gloss.trim().toLowerCase()) && !FRAGMENT_OK_POS.has(u.pos);
        const category = fragment ? "gloss" : !ex ? "no-example" : ex.origin === "tatoeba" && u.senses.length > 1 ? "tatoeba" : ex.source === "generated" ? "stored" : ex.origin === "wiktionary" ? "wiktionary" : "other";
        const item = {
          key: storedKey(w.form, u.pos, s.gloss),
          senseId: s.id,
          form: w.form,
          pos: u.pos,
          article: u.pos === "noun" ? (s.article ?? u.article) : undefined,
          gloss: s.gloss,
          register: s.register,
          others,
          example: ex ? { nl: ex.nl, en: ex.en, origin: ex.origin ?? ex.source } : undefined,
          forms: [w.form, ...(u.forms ?? []).map((f) => f.form).filter((f) => f && f !== "-")],
          frequency: w.frequency,
          category,
        };
        item.hash = hashOf(item);
        items.push(item);
      }
    }
  }
  return items;
}

/** What the review saw — a sense is reviewed again only when this changes. */
export function hashOf(item) {
  const seen = { form: item.form, pos: item.pos, gloss: item.gloss, others: item.others, nl: item.example?.nl, en: item.example?.en };
  return createHash("sha1").update(JSON.stringify(seen)).digest("hex").slice(0, 16);
}

const ORDER = ["gloss", "tatoeba", "stored", "other", "wiktionary", "no-example"];
/** Share of a pilot per category. */
const PILOT = { gloss: 0.2, tatoeba: 0.3, stored: 0.25, other: 0.05, wiktionary: 0.1, "no-example": 0.1 };

/** The next `limit` items to review, skipping those already reviewed. */
export function select(items, done, { limit, pilot }) {
  const todo = items.filter((it) => !done.has(it.hash));
  const byCat = new Map(ORDER.map((c) => [c, []]));
  for (const it of todo) byCat.get(it.category).push(it);
  for (const list of byCat.values()) list.sort((a, b) => a.frequency - b.frequency || a.key.localeCompare(b.key));
  if (!pilot) return ORDER.flatMap((c) => byCat.get(c)).slice(0, limit);
  const out = [];
  for (const c of ORDER) out.push(...byCat.get(c).slice(0, Math.round(limit * PILOT[c])));
  for (const c of ORDER) for (const it of byCat.get(c)) if (out.length < limit && !out.includes(it)) out.push(it);
  return out.slice(0, limit);
}

// ── Prompts ──

export const TRIAGE_SYSTEM = `You review entries of a Dutch-to-English dictionary for language learners. Each numbered item is ONE meaning of a Dutch word: the word, its part of speech, the English gloss of this meaning, the word's other meanings, and usually an example sentence with its translation.

Flag only real errors, never style preferences:
- bad-gloss: the gloss is not a correct English translation of this meaning, or is garbled or truncated (e.g. just "of", "act", "someone").
- place-name: the gloss describes a place (hamlet, village, neighbourhood) rather than a meaning of the word.
- offensive: the meaning is an ethnic or other slur.
- duplicate: this meaning is the same as one of the other meanings listed.
- wrong-meaning: the example uses the word in a different meaning than the gloss.
- ungrammatical: the Dutch sentence has a grammar, spelling or de/het error.
- unnatural: the Dutch sentence is grammatical but no native speaker would say it.
- bad-translation: the English translation does not say what the Dutch says.
Answer "ok" with no problems when the entry is correct.`;

export function triageItemText(it, n) {
  return [
    `${n}. ${it.article ? `${it.article} ${it.form}` : it.form} (${it.pos})${it.register ? ` [${it.register}]` : ""}`,
    `   gloss: ${it.gloss}`,
    `   other meanings: ${it.others.join("; ") || "none"}`,
    it.example ? `   example: ${it.example.nl}\n   translation: ${it.example.en}` : "   example: none",
  ].join("\n");
}

const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          verdict: { type: "string", enum: ["ok", "problem"] },
          problems: { type: "array", items: { type: "string", enum: PROBLEMS } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["n", "verdict", "problems", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

export const FIX_SYSTEM = `You correct entries of a Dutch-to-English dictionary for language learners. A first reviewer flagged possible problems with ONE meaning of a Dutch word. Decide whether each problem is real, then propose the smallest fix:
- "keep": nothing is actually wrong.
- "fix": give a corrected gloss and/or a new example; use null for what stays as it is.
  - gloss: the English translation of this meaning, at most 3 content words, plus at most one short parenthetical; verbs start with "to"; no articles.
  - example: one short, natural, everyday Dutch sentence (5-12 words) using the word in exactly this meaning, standard Netherlands spelling, correct de/het, the word itself or an inflected form, a separable verb not split; and its natural English translation. No names of people, no quotation marks.
- "drop": this meaning does not exist for this word, is a place name, duplicates one of the other meanings, or is a slur.
Give a one-sentence reason.`;

export function fixText(it, problems) {
  return [
    triageItemText(it, 1).replace(/^1\. /, "Word: "),
    `Flagged problems: ${problems.join(", ")}`,
  ].join("\n");
}

const FIX_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["keep", "fix", "drop"] },
    gloss: { anyOf: [{ type: "string" }, { type: "null" }] },
    nl: { anyOf: [{ type: "string" }, { type: "null" }] },
    en: { anyOf: [{ type: "string" }, { type: "null" }] },
    reason: { type: "string" },
  },
  required: ["action", "gloss", "nl", "en", "reason"],
  additionalProperties: false,
};

const CHECK_SYSTEM = `You check a Dutch learner's dictionary. Given a Dutch word, the English gloss of ONE of its meanings, and an example sentence with translation, answer whether the sentence uses the word in exactly that meaning (not another meaning of the same word), whether the Dutch is natural and correct, and whether the translation says the same thing as the sentence.`;

const CHECK_SCHEMA = {
  type: "object",
  properties: { sameSense: { type: "boolean" }, naturalDutch: { type: "boolean" }, translationMatches: { type: "boolean" } },
  required: ["sameSense", "naturalDutch", "translationMatches"],
  additionalProperties: false,
};

const jsonFormat = (schema) => ({ format: { type: "json_schema", schema } });

// ── Fix validation (no network) ──

/** A tier-2 answer turned into corrections, or why it can't be used. */
export function correctionsOf(it, answer) {
  if (!answer || answer.action === "keep") return { action: "keep" };
  if (answer.action === "drop") return { action: "drop", reason: answer.reason };
  const out = { action: "fix", reason: answer.reason };
  if (answer.gloss && answer.gloss.trim() !== it.gloss) {
    const gloss = answer.gloss.normalize("NFC").trim();
    if (glossIssues(gloss).length) return { action: "rejected", why: `gloss: ${glossIssues(gloss).join(", ")}` };
    out.gloss = gloss;
  }
  if (answer.nl || answer.en) {
    const { issues, nl, en } = issuesOf({ nl: answer.nl, en: answer.en }, it.forms);
    if (issues.length) return { action: "rejected", why: `example: ${issues.join(", ")}` };
    out.example = { nl, en };
  }
  if (!out.gloss && !out.example) return { action: "keep" };
  return out;
}

// ── Running ──

async function runBatch(api, requests, usage, log) {
  const out = new Map();
  if (!requests.length) return out;
  const batch = await api.messages.batches.create({ requests });
  log(`  batch ${batch.id}: ${requests.length} requests`);
  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, 20_000));
    status = await api.messages.batches.retrieve(batch.id);
  }
  for await (const result of await api.messages.batches.results(batch.id)) {
    if (result.result.type !== "succeeded") continue;
    const m = result.result.message;
    const u = (usage[m.model] ??= { input: 0, output: 0, requests: 0 });
    u.input += m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0);
    u.output += m.usage.output_tokens;
    u.requests++;
    if (m.stop_reason === "refusal") continue;
    try {
      out.set(result.custom_id, JSON.parse(m.content.find((b) => b.type === "text")?.text ?? ""));
    } catch {
      /* bad JSON: the item stays unreviewed and is tried again next run */
    }
  }
  return out;
}

export function costOf(usage) {
  let total = 0;
  for (const [model, u] of Object.entries(usage)) {
    const [pin, pout] = PRICES[model] ?? PRICES[Object.keys(PRICES).find((k) => model.startsWith(k))] ?? [0, 0];
    total += ((u.input * pin + u.output * pout) / 1e6) * 0.5;
  }
  return total;
}

const readJsonl = (path) => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const tsvCell = (s) => String(s).replace(/[\t\n]/g, " ").trim();

async function main() {
  const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
  const staticDir = args.get("static");
  if (!staticDir) throw new Error("--static=DIR (a static dictionary) is required");
  const limit = Number(args.get("limit") ?? 500);
  const pilot = args.has("pilot");
  const dry = args.has("dry");
  const t0 = Date.now();
  const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${msg}`);

  const words = readdirSync(join(staticDir, "w")).flatMap((f) => JSON.parse(readFileSync(join(staticDir, "w", f), "utf8")));
  const items = itemsOf(words);
  mkdirSync(REVIEW_DIR, { recursive: true });
  const triagePath = join(REVIEW_DIR, "tier1.jsonl");
  const fixPath = join(REVIEW_DIR, "tier2.jsonl");
  const done = new Set(readJsonl(triagePath).map((r) => r.hash));
  const batch = select(items, done, { limit, pilot });
  const byCat = Object.fromEntries(ORDER.map((c) => [c, batch.filter((i) => i.category === c).length]));
  log(`${items.length} senses, ${done.size} already reviewed; this run: ${batch.length} ${JSON.stringify(byCat)}`);

  if (dry) {
    const chars = batch.reduce((n, it) => n + triageItemText(it, 1).length, 0) + Math.ceil(batch.length / GROUP) * TRIAGE_SYSTEM.length;
    log(`dry run: ~${Math.round(chars / 3.5)} input tokens for tier 1 (estimate)`);
    console.log(batch.slice(0, 3).map((it, i) => triageItemText(it, i + 1)).join("\n"));
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required (or --dry)");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const api = new Anthropic();
  const usage = {};

  // Tier 1: triage.
  const groups = [];
  for (let i = 0; i < batch.length; i += GROUP) groups.push(batch.slice(i, i + GROUP));
  log(`tier 1: ${groups.length} requests to ${TRIAGE_MODEL}`);
  const triage = await runBatch(
    api,
    groups.map((g, gi) => ({
      custom_id: `t${gi}`,
      params: {
        model: TRIAGE_MODEL,
        max_tokens: 8000,
        output_config: { effort: "low", ...jsonFormat(TRIAGE_SCHEMA) },
        system: TRIAGE_SYSTEM,
        messages: [{ role: "user", content: g.map((it, i) => triageItemText(it, i + 1)).join("\n\n") }],
      },
    })),
    usage,
    log
  );
  const flagged = [];
  const at = new Date().toISOString();
  groups.forEach((g, gi) => {
    const answers = new Map((triage.get(`t${gi}`)?.items ?? []).map((a) => [a.n, a]));
    g.forEach((it, i) => {
      const a = answers.get(i + 1);
      if (!a) return; // unanswered: tried again next run
      const problems = (a.problems ?? []).filter((p) => PROBLEMS.includes(p));
      const verdict = a.verdict === "problem" && problems.length ? "problem" : "ok";
      appendFileSync(triagePath, JSON.stringify({ hash: it.hash, key: it.key, category: it.category, verdict, problems, confidence: a.confidence, model: TRIAGE_MODEL, at }) + "\n");
      if (verdict === "problem") flagged.push({ it, problems, confidence: a.confidence });
    });
  });
  log(`tier 1: ${flagged.length} of ${batch.length} flagged`);

  // Tier 2: confirm and fix.
  log(`tier 2: ${flagged.length} requests to ${FIX_MODEL}`);
  const fixes = await runBatch(
    api,
    flagged.map((f, i) => ({
      custom_id: `f${i}`,
      params: {
        model: FIX_MODEL,
        max_tokens: 4000,
        output_config: { effort: "medium", ...jsonFormat(FIX_SCHEMA) },
        system: FIX_SYSTEM,
        messages: [{ role: "user", content: fixText(f.it, f.problems) }],
      },
    })),
    usage,
    log
  );
  const proposals = flagged.map((f, i) => ({ ...f, answer: fixes.get(`f${i}`), result: correctionsOf(f.it, fixes.get(`f${i}`)) }));

  // Check: a second model reads every new example.
  const toCheck = proposals.filter((p) => p.result.example);
  log(`check: ${toCheck.length} new examples to ${CHECK_MODEL}`);
  const checks = await runBatch(
    api,
    toCheck.map((p, i) => ({
      custom_id: `c${i}`,
      params: {
        model: CHECK_MODEL,
        max_tokens: 2000,
        output_config: { effort: "low", ...jsonFormat(CHECK_SCHEMA) },
        system: CHECK_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Word: ${p.it.form} (${p.it.pos})\nMeaning: ${p.result.gloss ?? p.it.gloss}\nAll meanings of this word: ${[p.result.gloss ?? p.it.gloss, ...p.it.others].join("; ")}\nSentence: ${p.result.example.nl}\nTranslation: ${p.result.example.en}`,
          },
        ],
      },
    })),
    usage,
    log
  );
  toCheck.forEach((p, i) => {
    const c = checks.get(`c${i}`);
    if (!c?.sameSense || !c?.naturalDutch || !c?.translationMatches) p.result = { action: "rejected", why: "example: second model disagreed" };
  });

  // Write corrections and the review log.
  mkdirSync(CORRECTIONS_DIR, { recursive: true });
  const lines = { glosses: [], examples: [], drop: [] };
  for (const p of proposals) {
    const [form, pos, gloss] = p.it.key.split("\t");
    appendFileSync(fixPath, JSON.stringify({ hash: p.it.hash, key: p.it.key, problems: p.problems, answer: p.answer ?? null, result: p.result, model: FIX_MODEL, at }) + "\n");
    if (p.result.action === "drop") lines.drop.push([form, pos, gloss, tsvCell(p.result.reason)]);
    if (p.result.gloss) lines.glosses.push([form, pos, gloss, p.result.gloss]);
    if (p.result.example) lines.examples.push([form, pos, gloss, tsvCell(p.result.example.nl), tsvCell(p.result.example.en)]);
  }
  for (const [kind, rows] of Object.entries(lines)) {
    if (!rows.length) continue;
    const path = join(CORRECTIONS_DIR, `${kind}-review.tsv`);
    const header = existsSync(path) ? "" : `# ${kind} corrections proposed by scripts/dictionary/review.mjs — see corrections.mjs\n`;
    appendFileSync(path, header + rows.map((r) => r.map(tsvCell).join("\t")).join("\n") + "\n");
  }

  const report = reportOf({ batch, flagged, proposals, usage, pilot, byCat });
  writeFileSync(join(REVIEW_DIR, "report.md"), report);
  console.log(report);
}

/** The run's report, for the person who merges it. */
export function reportOf({ batch, flagged, proposals, usage, pilot, byCat }) {
  const count = (pred) => proposals.filter(pred).length;
  const problemCounts = {};
  for (const f of flagged) for (const p of f.problems) problemCounts[p] = (problemCounts[p] ?? 0) + 1;
  const flaggedBy = Object.fromEntries(ORDER.map((c) => [c, flagged.filter((f) => f.it.category === c).length]));
  const sample = proposals.filter((p) => p.result.action !== "keep").slice(0, 50);
  const tokens = Object.entries(usage).map(([m, u]) => `| ${m} | ${u.requests} | ${u.input.toLocaleString("en")} | ${u.output.toLocaleString("en")} |`);
  return [
    `# Dictionary review${pilot ? " — pilot" : ""}`,
    "",
    `Reviewed **${batch.length}** senses; tier 1 flagged **${flagged.length}** (${batch.length ? Math.round((100 * flagged.length) / batch.length) : 0}%).`,
    "",
    "| Category | Reviewed | Flagged |",
    "|---|---|---|",
    ...ORDER.map((c) => `| ${c} | ${byCat[c] ?? 0} | ${flaggedBy[c]} |`),
    "",
    `Problems flagged: ${Object.entries(problemCounts).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`,
    "",
    `Tier 2 outcome: **${count((p) => p.result.action === "fix")}** fixes, **${count((p) => p.result.action === "drop")}** drops, ${count((p) => p.result.action === "keep")} kept as is (tier 1 was wrong), ${count((p) => p.result.action === "rejected")} proposals rejected by the checks.`,
    "",
    "## Cost",
    "",
    "| Model | Requests | Input tokens | Output tokens |",
    "|---|---|---|---|",
    ...tokens,
    "",
    `Estimated cost (batch prices): **$${costOf(usage).toFixed(3)}** — about $${batch.length ? ((costOf(usage) / batch.length) * 1000).toFixed(2) : "0"} per 1,000 senses.`,
    "",
    "## Proposed changes (first 50)",
    "",
    ...sample.map((p) => {
      const [form, pos, gloss] = p.it.key.split("\t");
      const r = p.result;
      const head = `- **${form}** (${pos}) “${gloss}” — ${p.problems.join(", ")}`;
      if (r.action === "drop") return `${head}\n  - DROP: ${r.reason}`;
      if (r.action === "rejected") return `${head}\n  - rejected: ${r.why}`;
      return [
        head,
        r.gloss ? `  - gloss → “${r.gloss}”` : null,
        r.example ? `  - example: ~~${p.it.example?.nl ?? "none"}~~ → ${r.example.nl} (${r.example.en})` : null,
        `  - why: ${r.reason}`,
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "",
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

/* The quality review — every published sense's gloss and example, checked
   by a model, cheapest first; fixes proposed as reviewed corrections
   (corrections.mjs), never written to the dictionary directly.

     node scripts/dictionary/review.mjs --static=DIR [--limit=N] [--pilot] [--dry]

   DIR is a static dictionary (static.mjs output, the "dictionary-latest"
   release). Needs ANTHROPIC_API_KEY unless --dry.

   Tier 1  claude-haiku-5-5 reads 25 senses per request (gloss, the word's
           other meanings, the example) and only says ok or what is wrong.
   Tier 2  claude-sonnet-5-5 (or --fix-model=claude-haiku-5-5), for flagged senses only, confirms the problem
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
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glossIssues } from "../../src/lib/dictionary/checks.ts";
import { issuesOf } from "../../supabase/functions/example/check.ts";
import { CORRECTIONS_DIR } from "./corrections.mjs";
import { ROOT } from "./paths.mjs";
import { storedKey } from "./stored.mjs";

export const TRIAGE_MODEL = "claude-haiku-5-5";
/** Tier 2 model. Haiku alone (--fix-model=claude-haiku-5-5) costs a tenth,
 *  but in the pilot it dropped core meanings ("ik hou van jou", "door:
 *  through") and wrote wrong Dutch ("Het licht is nu af"). */
export const FIX_MODEL = "claude-sonnet-5-5";
/** Reads every new example. Haiku passed wrong Dutch in round 1 ("Ik heb me
 *  vertelt"); Sonnet costs about $0.15 more per round of 5,000. */
export const CHECK_MODEL = "claude-sonnet-5-5";
const GROUP = 25;
const FIX_GROUP = 5;
/** $ per million tokens, input / output, before the 50% batch discount. */
export const PRICES = { "claude-haiku-5-5": [0.1, 0.5], "claude-sonnet-5-5": [2, 10] };

const REVIEW_DIR = join(ROOT, "data", "review");
export const PROBLEMS = ["bad-gloss", "wrong-article", "wrong-type", "place-name", "offensive", "duplicate", "wrong-meaning", "ungrammatical", "unnatural", "bad-translation"];

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
          // Confirmed by two sources (or a source and the noun's ending):
          // the review isn't asked about it.
          articleVerified: u.pos !== "noun" || u.fieldMeta?.article?.confidence === "verified",
          gloss: s.gloss,
          register: s.register,
          others,
          // Meanings the word keeps under its other parts of speech — not in
          // the hash, so it doesn't send reviewed senses back to review.
          senses: u.senses.length,
          otherUses: w.uses.filter((o) => o !== u).reduce((n, o) => n + o.senses.length, 0),
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

/** The next `limit` items to review, skipping those already reviewed and
 *  words ranked below `maxRank`: garbled glosses first, then by frequency. */
export function select(items, done, { limit, pilot, maxRank = Infinity }) {
  const todo = items.filter((it) => !done.has(it.hash) && it.frequency <= maxRank);
  const byFrequency = (a, b) => a.frequency - b.frequency || a.key.localeCompare(b.key);
  if (!pilot) return todo.sort((a, b) => Number(b.category === "gloss") - Number(a.category === "gloss") || byFrequency(a, b)).slice(0, limit);
  const byCat = new Map(ORDER.map((c) => [c, []]));
  for (const it of todo) byCat.get(it.category).push(it);
  for (const list of byCat.values()) list.sort(byFrequency);
  const out = [];
  for (const c of ORDER) out.push(...byCat.get(c).slice(0, Math.round(limit * PILOT[c])));
  for (const c of ORDER) for (const it of byCat.get(c)) if (out.length < limit && !out.includes(it)) out.push(it);
  return out.slice(0, limit);
}

// ── Prompts ──

export const TRIAGE_SYSTEM = `You review entries of a Dutch-to-English dictionary for language learners. Each numbered item is ONE meaning of a Dutch word: the word, its part of speech, the English gloss of this meaning, the word's other meanings, and usually an example sentence with its translation.

Flag only real errors, never style preferences:
- bad-gloss: the gloss is not a correct English translation of this meaning, or is garbled or truncated (e.g. just "of", "act", "someone").
- wrong-article: only for items marked [article unverified]: the noun takes the other article (de/het), or none is given.
- wrong-type: the word is not this part of speech in this meaning (e.g. a noun listed as an adjective).
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
    `${n}. ${it.article ? `${it.article} ${it.form}` : it.form} (${it.pos})${it.register ? ` [${it.register}]` : ""}${it.articleVerified ? "" : " [article unverified]"}`,
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

export const FIX_SYSTEM = `You correct entries of a Dutch-to-English dictionary for language learners. A first reviewer flagged possible problems with each numbered item, ONE meaning of a Dutch word. For every item, decide whether the problems are real, then propose the smallest fix:
- "keep": nothing is actually wrong.
- "fix": give a corrected gloss and/or a new example; use null for what stays as it is.
  - gloss: the English translation of this meaning, at most 3 content words, plus at most one short parenthetical; verbs start with "to"; no articles.
  - example: one short, natural, everyday Dutch sentence (5-12 words) using the word in exactly this meaning, standard Netherlands spelling, correct de/het, the word itself or an inflected form, a separable verb not split; and its natural English translation. No names of people, no quotation marks.
  - keepExample: false when the current example does not fit the (corrected) meaning and you give no new one; true otherwise.
  - article: "de" or "het" only when the noun's article is wrong or missing; null otherwise.
  - wrong part of speech: "drop" when this meaning is already listed under the right part of speech; otherwise "keep" and say so in the reason.
- "drop": this meaning does not exist for this word, is a place name on a common word, duplicates one of the other meanings, or is so obscure or archaic that it only confuses a learner.
  - NEVER drop an idiom, fixed expression, phrase, proverb, proper name (a person, city, country, religious figure) or informal/slang meaning that Dutch speakers really use: these are what a learner looks up. Fix its gloss instead, or "keep".
  - NEVER drop a word's only meaning ("other meanings: none"): fix it instead.
  - An offensive meaning that exists is kept and stays marked as such; drop only a slur with no other use.
- A gloss fix must not repeat one of the other meanings; when the meaning is only a repeat of another one, "drop" it.
Answer every item, with its number and a one-sentence reason.`;

export function fixText(it, problems, n = 1) {
  return [triageItemText(it, n), `   flagged problems: ${problems.join(", ")}`].join("\n");
}

const FIX_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          action: { type: "string", enum: ["keep", "fix", "drop"] },
          gloss: { anyOf: [{ type: "string" }, { type: "null" }] },
          nl: { anyOf: [{ type: "string" }, { type: "null" }] },
          en: { anyOf: [{ type: "string" }, { type: "null" }] },
          keepExample: { type: "boolean" },
          article: { anyOf: [{ type: "string", enum: ["de", "het"] }, { type: "null" }] },
          reason: { type: "string" },
        },
        required: ["n", "action", "gloss", "nl", "en", "keepExample", "article", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
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

/** "to take (for)" → "take": what two glosses are compared by. */
export const glossCore = (g) =>
  (g ?? "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/^\s*to\s+/, "").replace(/\s+/g, " ").trim();

/** A tier-2 answer turned into corrections, or why it can't be used. */
export function correctionsOf(it, answer, problems = []) {
  if (!answer || answer.action === "keep") return { action: "keep" };
  if (answer.action === "drop") {
    // The word's last meaning goes only when it's a place name or a slur —
    // otherwise it was an idiom, a name or a phrase the model didn't know.
    const last = !it.others.length && !it.otherUses;
    if (last && !problems.some((p) => p === "place-name" || p === "offensive")) return { action: "rejected", why: "drop: the word's only meaning" };
    return { action: "drop", reason: answer.reason };
  }
  const out = { action: "fix", reason: answer.reason };
  // An article is changed only when both models say so, and never one two
  // sources already agree on.
  if (problems.includes("wrong-article") && !it.articleVerified && it.pos === "noun" && (answer.article === "de" || answer.article === "het") && answer.article !== it.article) {
    out.article = answer.article;
  }
  if (answer.gloss && answer.gloss.trim() !== it.gloss) {
    const gloss = answer.gloss.normalize("NFC").trim();
    // An example written for a gloss that can't be used can't be used either.
    if (glossIssues(gloss).length) return { action: "rejected", why: `gloss: ${glossIssues(gloss).join(", ")}` };
    // Rewriting one meaning into another erases it ("komen: to become" →
    // "to come"); the build would then merge the two.
    if (it.others.some((o) => glossCore(o) === glossCore(gloss))) return { action: "rejected", why: "gloss: repeats another meaning" };
    out.gloss = gloss;
  }
  if ((answer.nl || answer.en) && answer.nl?.trim() !== it.example?.nl) {
    const { issues, nl, en } = issuesOf({ nl: answer.nl, en: answer.en }, it.forms);
    // A failed example doesn't cost the gloss fix that came with it.
    if (issues.length) out.exampleRejected = `example: ${issues.join(", ")}`;
    else out.example = { nl, en };
  }
  if (!out.example && it.example && answer.keepExample === false) out.removeExample = true;
  if (!out.gloss && !out.example && !out.article && !out.removeExample) return out.exampleRejected ? { action: "rejected", why: out.exampleRejected } : { action: "keep" };
  return out;
}

/** Drops in one round that together would leave a word with no meaning at
 *  all become rejections — the per-sense guard sees one drop at a time. */
export function keepWholeWords(proposals) {
  const drops = new Map();
  for (const p of proposals) if (p.result.action === "drop") drops.set(p.it.form, [...(drops.get(p.it.form) ?? []), p]);
  for (const ps of drops.values()) {
    const it = ps[0].it;
    if (ps.length < it.senses + it.otherUses) continue;
    for (const p of ps) if (!p.problems.some((x) => x === "place-name" || x === "offensive")) p.result = { action: "rejected", why: "drop: the word's only meaning" };
  }
  return proposals;
}

// ── Running ──

/** Batches of an unfinished run, so a run cut off while waiting (a CI time
 *  limit) collects the results it already paid for instead of resubmitting.
 *  `key` names the run: the same senses, models and stage. */
export class BatchState {
  constructor(path, key) {
    this.path = path;
    this.key = key;
    const saved = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
    this.batches = saved?.key === key ? saved.batches : {};
  }
  get(stage) {
    return this.batches[stage];
  }
  set(stage, id) {
    this.batches[stage] = id;
    writeFileSync(this.path, JSON.stringify({ key: this.key, batches: this.batches }, null, 1));
  }
  done() {
    if (existsSync(this.path)) rmSync(this.path);
  }
}

async function runBatch(api, requests, usage, log, state, stage) {
  const out = new Map();
  if (!requests.length) return out;
  const saved = state?.get(stage);
  const batch = saved ? await api.messages.batches.retrieve(saved) : await api.messages.batches.create({ requests });
  if (!saved) state?.set(stage, batch.id);
  log(`  batch ${batch.id}${saved ? " (resumed)" : ""}: ${requests.length} requests`);
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
  const fixModel = String(args.get("fix-model") ?? FIX_MODEL);
  const maxRank = args.has("max-rank") ? Number(args.get("max-rank")) : Infinity;
  const recall = args.has("recall") ? Number(args.get("recall")) : 0;
  const t0 = Date.now();
  const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${msg}`);

  const words = readdirSync(join(staticDir, "w")).flatMap((f) => JSON.parse(readFileSync(join(staticDir, "w", f), "utf8")));
  const items = itemsOf(words);
  mkdirSync(REVIEW_DIR, { recursive: true });
  const triagePath = join(REVIEW_DIR, "tier1.jsonl");
  const fixPath = join(REVIEW_DIR, "tier2.jsonl");
  const reviewed = readJsonl(triagePath);
  const done = new Set(reviewed.map((r) => r.hash));
  if (recall) return recallCheck({ items, reviewed, n: recall, fixModel, log });
  const batch = select(items, done, { limit, pilot, maxRank });
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
  const state = new BatchState(join(REVIEW_DIR, "batches.json"), createHash("sha1").update(JSON.stringify([batch.map((it) => it.hash), fixModel])).digest("hex"));

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
    log,
    state,
    "triage"
  );
  const flagged = [];
  // Written at the end, with everything else: a run cut off before then
  // selects the same senses again and resumes its batches.
  const triageLines = [];
  const at = new Date().toISOString();
  groups.forEach((g, gi) => {
    const answers = new Map((triage.get(`t${gi}`)?.items ?? []).map((a) => [a.n, a]));
    g.forEach((it, i) => {
      const a = answers.get(i + 1);
      if (!a) return; // unanswered: tried again next run
      const problems = (a.problems ?? []).filter((p) => PROBLEMS.includes(p));
      const verdict = a.verdict === "problem" && problems.length ? "problem" : "ok";
      triageLines.push(JSON.stringify({ hash: it.hash, key: it.key, category: it.category, verdict, problems, confidence: a.confidence, model: TRIAGE_MODEL, at }));
      if (verdict === "problem") flagged.push({ it, problems, confidence: a.confidence });
    });
  });
  log(`tier 1: ${flagged.length} of ${batch.length} flagged`);

  // Tier 2: confirm and fix, a few senses per request — the instructions
  // are most of a request's tokens.
  const fixGroups = [];
  for (let i = 0; i < flagged.length; i += FIX_GROUP) fixGroups.push(flagged.slice(i, i + FIX_GROUP));
  log(`tier 2: ${flagged.length} senses in ${fixGroups.length} requests to ${fixModel}`);
  const fixes = await runBatch(
    api,
    fixGroups.map((g, gi) => ({
      custom_id: `f${gi}`,
      params: {
        model: fixModel,
        max_tokens: 8000,
        output_config: { effort: "medium", ...jsonFormat(FIX_SCHEMA) },
        system: FIX_SYSTEM,
        messages: [{ role: "user", content: g.map((f, i) => fixText(f.it, f.problems, i + 1)).join("\n\n") }],
      },
    })),
    usage,
    log,
    state,
    "fix"
  );
  const proposals = fixGroups.flatMap((g, gi) => {
    const answers = new Map((fixes.get(`f${gi}`)?.items ?? []).map((a) => [a.n, a]));
    return g.map((f, i) => {
      const answer = answers.get(i + 1);
      return { ...f, answer, result: correctionsOf(f.it, answer, f.problems) };
    });
  });

  keepWholeWords(proposals);

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
    log,
    state,
    "check"
  );
  toCheck.forEach((p, i) => {
    const c = checks.get(`c${i}`);
    if (c?.sameSense && c?.naturalDutch && c?.translationMatches) return;
    // The gloss fix stands on its own; only the example goes.
    if (p.result.gloss) p.result = { ...p.result, example: undefined, exampleRejected: "example: second model disagreed" };
    else p.result = { action: "rejected", why: "example: second model disagreed" };
  });

  // Write corrections and the review log.
  if (triageLines.length) appendFileSync(triagePath, triageLines.join("\n") + "\n");
  mkdirSync(CORRECTIONS_DIR, { recursive: true });
  const lines = { glosses: [], examples: [], drop: [], articles: [], noexample: [] };
  for (const p of proposals) {
    const [form, pos, gloss] = p.it.key.split("\t");
    appendFileSync(fixPath, JSON.stringify({ hash: p.it.hash, key: p.it.key, problems: p.problems, answer: p.answer ?? null, result: p.result, model: fixModel, at }) + "\n");
    if (p.result.action === "drop") lines.drop.push([form, pos, gloss, tsvCell(p.result.reason)]);
    if (p.result.gloss) lines.glosses.push([form, pos, gloss, p.result.gloss]);
    if (p.result.example) lines.examples.push([form, pos, gloss, tsvCell(p.result.example.nl), tsvCell(p.result.example.en)]);
    if (p.result.article) lines.articles.push([form, pos, gloss, p.result.article]);
    if (p.result.removeExample) lines.noexample.push([form, pos, gloss]);
  }
  for (const [kind, rows] of Object.entries(lines)) {
    if (!rows.length) continue;
    const path = join(CORRECTIONS_DIR, `${kind}-review.tsv`);
    const header = existsSync(path) ? "" : `# ${kind} corrections proposed by scripts/dictionary/review.mjs — see corrections.mjs\n`;
    appendFileSync(path, header + rows.map((r) => r.map(tsvCell).join("\t")).join("\n") + "\n");
  }

  const report = reportOf({ batch, flagged, proposals, usage, pilot, byCat });
  writeFileSync(join(REVIEW_DIR, "report.md"), report);
  state.done();
  console.log(report);
}

/** How many errors tier 1 lets through: the larger model triages a sample
 *  of senses tier 1 called ok. Writes data/review/recall.md only. */
async function recallCheck({ items, reviewed, n, fixModel, log }) {
  const ok = new Set(reviewed.filter((r) => r.verdict === "ok").map((r) => r.hash));
  // An even spread: every k-th ok sense, in hash order.
  const pool = items.filter((it) => ok.has(it.hash)).sort((a, b) => a.hash.localeCompare(b.hash));
  const step = Math.max(1, Math.floor(pool.length / n));
  const sample = pool.filter((_, i) => i % step === 0).slice(0, n);
  log(`recall: ${sample.length} of ${pool.length} senses tier 1 called ok, to ${fixModel}`);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const api = new Anthropic();
  const usage = {};
  const groups = [];
  for (let i = 0; i < sample.length; i += GROUP) groups.push(sample.slice(i, i + GROUP));
  const answers = await runBatch(
    api,
    groups.map((g, gi) => ({
      custom_id: `r${gi}`,
      params: {
        model: fixModel,
        max_tokens: 8000,
        output_config: { effort: "medium", ...jsonFormat(TRIAGE_SCHEMA) },
        system: TRIAGE_SYSTEM,
        messages: [{ role: "user", content: g.map((it, i) => triageItemText(it, i + 1)).join("\n\n") }],
      },
    })),
    usage,
    log
  );
  const missed = [];
  groups.forEach((g, gi) => {
    for (const a of answers.get(`r${gi}`)?.items ?? []) {
      const it = g[a.n - 1];
      if (it && a.verdict === "problem" && a.problems?.length && a.confidence !== "low") missed.push({ it, problems: a.problems });
    }
  });
  const md = [
    "# Review recall check",
    "",
    `${fixModel} re-read **${sample.length}** senses that tier 1 (${TRIAGE_MODEL}) called ok, and flagged **${missed.length}** (${sample.length ? Math.round((100 * missed.length) / sample.length) : 0}%) with medium or high confidence.`,
    "",
    `Cost: $${costOf(usage).toFixed(3)}`,
    "",
    ...missed.map(({ it, problems }) => `- **${it.form}** (${it.pos}) “${it.gloss}”${it.example ? ` — ${it.example.nl}` : ""} — ${problems.join(", ")}`),
    "",
  ].join("\n");
  writeFileSync(join(REVIEW_DIR, "recall.md"), md);
  console.log(md);
}

/** The run's report, for the person who merges it. */
export function reportOf({ batch, flagged, proposals, usage, pilot, byCat }) {
  const count = (pred) => proposals.filter(pred).length;
  const problemCounts = {};
  for (const f of flagged) for (const p of f.problems) problemCounts[p] = (problemCounts[p] ?? 0) + 1;
  const flaggedBy = Object.fromEntries(ORDER.map((c) => [c, flagged.filter((f) => f.it.category === c).length]));
  // A spread over the whole run, not its first (most suspicious) entries.
  const sample = proposals
    .filter((p) => p.result.action !== "keep")
    .sort((a, b) => a.it.hash.localeCompare(b.it.hash))
    .slice(0, 50);
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
    `Tier 2 outcome: **${count((p) => p.result.action === "fix")}** fixes, **${count((p) => p.result.action === "drop")}** drops, ${count((p) => p.result.action === "keep")} kept as is (tier 1 was wrong), ${count((p) => p.result.action === "rejected")} proposals rejected by the checks. Within the fixes: ${count((p) => p.result.gloss)} glosses, ${count((p) => p.result.article)} articles, ${count((p) => p.result.example)} new examples, ${count((p) => p.result.removeExample)} examples removed.`,
    "",
    "## Cost",
    "",
    "| Model | Requests | Input tokens | Output tokens |",
    "|---|---|---|---|",
    ...tokens,
    "",
    `Estimated cost (batch prices): **$${costOf(usage).toFixed(3)}** — about $${batch.length ? ((costOf(usage) / batch.length) * 1000).toFixed(2) : "0"} per 1,000 senses.`,
    "",
    "## Proposed changes (50 at random)",
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
        r.article ? `  - article: ${p.it.article ?? "none"} → ${r.article}` : null,
        r.example ? `  - example: ~~${p.it.example?.nl ?? "none"}~~ → ${r.example.nl} (${r.example.en})` : null,
        r.removeExample ? `  - example removed: ~~${p.it.example?.nl}~~ (written again on demand)` : null,
        `  - why: ${r.reason}`,
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "",
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

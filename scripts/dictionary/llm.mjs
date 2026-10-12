/* The model step — optional, enabled with --llm and ANTHROPIC_API_KEY.

   The model SELECTS and CONDENSES; it never invents. Three jobs:

     condenseGlosses       a too-long gloss → at most 3 content words, every
                           one of which must already be in the source gloss
                           (selectedFrom) — a selection, checked mechanically
     writeAndCheckExamples a sentence for a sense that has none; it passes the
                           same mechanical checks as any corpus sentence, up
                           to 3 attempts, then the doubt queue
     same-sense check      a SECOND model reads gloss + example and says
                           whether they express the same meaning — for
                           generated and Tatoeba sentences alike

   Grammar (gender, plural, forms) never comes from here. Requests go
   through the Message Batches API: tens of thousands of short requests,
   no latency requirement, half the price. */
import Anthropic from "@anthropic-ai/sdk";
import { glossIssues } from "../../src/lib/dictionary/checks.ts";
import { selectedFrom } from "./assemble.mjs";
import { exampleIssues, targetForms } from "./examples.mjs";

const WRITER = "claude-opus-5-5";
/** A different model checks the writer's work. */
const CHECKER = "claude-sonnet-5-5";
const MAX_ATTEMPTS = 3;

/** Created on first use, so importing this module never touches credentials. */
let clientInstance = null;
const api = () => (clientInstance ??= new Anthropic());

function jsonFormat(properties, required) {
  return { format: { type: "json_schema", schema: { type: "object", properties, required, additionalProperties: false } } };
}

/** Runs requests as one or more batches; returns custom_id → parsed JSON
 *  (or null when the request failed, was refused, or returned bad JSON). */
async function runBatch(requests, log) {
  const out = new Map();
  for (let i = 0; i < requests.length; i += 50_000) {
    const chunk = requests.slice(i, i + 50_000);
    const batch = await api().messages.batches.create({ requests: chunk });
    log(`  batch ${batch.id}: ${chunk.length} requests`);
    let status = batch;
    while (status.processing_status !== "ended") {
      await new Promise((r) => setTimeout(r, 30_000));
      status = await api().messages.batches.retrieve(batch.id);
    }
    for await (const result of await api().messages.batches.results(batch.id)) {
      if (result.result.type !== "succeeded") {
        out.set(result.custom_id, null);
        continue;
      }
      const message = result.result.message;
      if (message.stop_reason === "refusal") {
        out.set(result.custom_id, null);
        continue;
      }
      const text = message.content.find((b) => b.type === "text")?.text ?? "";
      try {
        out.set(result.custom_id, JSON.parse(text));
      } catch {
        out.set(result.custom_id, null);
      }
    }
  }
  return out;
}

const GLOSS_SYSTEM = `You shorten English glosses for a Dutch-English learner's dictionary.
Rules:
- Output ONE meaning: the one an everyday learner most needs.
- At most 3 content words, plus at most one short parenthetical, e.g. "to feel like (something)".
- Use ONLY words that appear in the source gloss. Do not add, translate or explain anything.
- Verbs start with "to". Nouns take no article.`;

/** Condenses every gloss in `items` ({word, use, sense}) in place. A
 *  result that fails the gloss rule or uses words the source gloss doesn't
 *  have is discarded — the sense then goes to the doubt queue. */
export async function condenseGlosses(items, { log }) {
  if (!items.length) return;
  log(`model: condensing ${items.length} glosses…`);
  const requests = items.map((it, i) => ({
    custom_id: `g${i}`,
    params: {
      model: WRITER,
      max_tokens: 2000,
      output_config: { effort: "low", ...jsonFormat({ gloss: { type: "string" } }, ["gloss"]) },
      system: GLOSS_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Dutch word: ${it.word.form} (${it.use.pos})\nSource gloss: ${it.sense.rawGloss}\nOther meanings of this word (do not repeat them): ${it.use.senses.filter((s) => s !== it.sense).map((s) => s.gloss).filter(Boolean).join("; ") || "none"}`,
        },
      ],
    },
  }));
  const results = await runBatch(requests, log);
  let accepted = 0;
  items.forEach((it, i) => {
    const gloss = results.get(`g${i}`)?.gloss?.trim();
    if (!gloss || glossIssues(gloss).length || !selectedFrom(gloss, it.sense.rawGloss)) return;
    it.sense.gloss = gloss;
    it.sense.meta = { ...it.sense.meta, sources: [...new Set([...it.sense.meta.sources, "llm"])] };
    accepted++;
  });
  log(`model: ${accepted}/${items.length} glosses condensed and accepted`);
}

const EXAMPLE_SYSTEM = `You write example sentences for a Dutch learner's dictionary.
Write ONE short, natural, everyday Dutch sentence (5-12 words) that uses the given word in exactly the given meaning, and a natural English translation with the same meaning.
- Use standard Netherlands Dutch spelling (Woordenlijst), correct de/het for every noun.
- The word must appear in the sentence (any inflected form; a separable verb may be split).
- No names of real people, no quotes, no brand names.`;

const CHECK_SYSTEM = `You check a Dutch learner's dictionary. Given a Dutch word, the English gloss of ONE of its meanings, and an example sentence with translation, answer whether the sentence uses the word in exactly that meaning (not another meaning of the same word), and whether the translation says the same thing as the sentence.`;

function senseList(words) {
  const out = [];
  for (const word of words.values()) {
    for (const use of word.uses) for (const sense of use.senses) out.push({ word, use, sense });
  }
  return out;
}

/** Writes an example for every sense without one, checks every model and
 *  Tatoeba example with the second model, and queues what fails. */
export async function writeAndCheckExamples(words, checkCtx, { log, doubts }) {
  const all = senseList(words);

  // Same-sense check for real sentences the source didn't pin to a sense.
  const tatoeba = all.filter((x) => x.sense.examples.some((e) => e.origin === "tatoeba"));
  if (tatoeba.length) {
    log(`model: checking ${tatoeba.length} Tatoeba examples…`);
    const verdicts = await checkSameSense(tatoeba.map((x) => ({ ...x, example: x.sense.examples[0] })), log);
    tatoeba.forEach((x, i) => {
      if (verdicts[i]) return;
      doubts.push({ word: x.word.form, scope: "example", pos: x.use.pos, reason: "example: different sense (model check)", detail: { gloss: x.sense.gloss, sentence: x.sense.examples[0].nl } });
      x.sense.examples = x.sense.examples.filter((e) => e.origin !== "tatoeba");
    });
  }

  let pending = all.filter((x) => x.sense.examples.length === 0);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
    log(`model: writing examples, attempt ${attempt}: ${pending.length} senses…`);
    const requests = pending.map((x, i) => ({
      custom_id: `e${i}`,
      params: {
        model: WRITER,
        max_tokens: 2000,
        output_config: { effort: "low", ...jsonFormat({ nl: { type: "string" }, en: { type: "string" } }, ["nl", "en"]) },
        system: EXAMPLE_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Word: ${x.word.form}${x.use.article ? ` (${x.sense.article ?? x.use.article} ${x.word.form})` : ""}\nPart of speech: ${x.use.pos}\nMeaning: ${x.sense.gloss}${x.sense.glossNote ? ` — ${x.sense.glossNote}` : ""}\nOther meanings NOT to use: ${x.use.senses.filter((s) => s !== x.sense).map((s) => s.gloss).join("; ") || "none"}`,
          },
        ],
      },
    }));
    const drafts = await runBatch(requests, log);
    const passed = [];
    const failed = [];
    pending.forEach((x, i) => {
      const d = drafts.get(`e${i}`);
      if (!d?.nl || !d?.en) return failed.push(x);
      const example = { nl: d.nl.normalize("NFC").trim(), en: d.en.normalize("NFC").trim() };
      const { issues, spans } = exampleIssues(example, targetForms(x.word, x.use), checkCtx);
      if (issues.length) {
        x.lastIssues = issues;
        return failed.push(x);
      }
      passed.push({ ...x, example: { ...example, targetSpans: spans, source: "generated" } });
    });
    const verdicts = await checkSameSense(passed, log);
    passed.forEach((x, i) => {
      if (verdicts[i]) {
        x.sense.examples = [x.example];
        x.sense.meta = { ...x.sense.meta, sources: [...new Set([...x.sense.meta.sources, "llm"])] };
      } else {
        x.lastIssues = ["different sense (model check)"];
        failed.push(x);
      }
    });
    pending = failed;
  }
  for (const x of pending) {
    doubts.push({ word: x.word.form, scope: "example", pos: x.use.pos, reason: "example: failed checks 3 times", detail: { gloss: x.sense.gloss, issues: x.lastIssues ?? ["no draft"] } });
  }
}

async function checkSameSense(items, log) {
  if (!items.length) return [];
  const requests = items.map((x, i) => ({
    custom_id: `c${i}`,
    params: {
      model: CHECKER,
      max_tokens: 2000,
      output_config: { effort: "low", ...jsonFormat({ sameSense: { type: "boolean" }, translationMatches: { type: "boolean" } }, ["sameSense", "translationMatches"]) },
      system: CHECK_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Word: ${x.word.form} (${x.use.pos})\nMeaning: ${x.sense.gloss}\nAll meanings of this word: ${x.use.senses.map((s) => s.gloss).join("; ")}\nSentence: ${x.example.nl}\nTranslation: ${x.example.en}`,
        },
      ],
    },
  }));
  const results = await runBatch(requests, log);
  return items.map((_, i) => {
    const r = results.get(`c${i}`);
    return Boolean(r?.sameSense && r?.translationMatches);
  });
}

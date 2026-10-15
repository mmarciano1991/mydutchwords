/* example — an example sentence, on demand, for a dictionary sense that
   shipped without one ("Example coming soon").

   POST { senseId } → { nl, en, targetSpans, source }.

     1. Already written (dict_generated_examples)?  Served from there.
     2. The sense has an example in the dictionary?  That one, at no cost.
     3. Otherwise a small model writes one sentence, it must pass the
        mechanical checks (check.ts), and it is stored — so each sense is
        paid for once, ever, and shared by every learner. The next
        dictionary build folds it into the published entry.

   Only senses that exist in the dictionary are accepted, and a sense the
   model fails on a few times is given up on — together that bounds what a
   stray caller can spend to one short sentence per dictionary sense.

   Secrets (supabase secrets set …):
     ANTHROPIC_API_KEY   the Claude API key
     EXAMPLE_MODEL       optional; defaults to claude-haiku-5-5
   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

   No user JWT (verify_jwt = false in config.toml): the app works signed out. */
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.124.0";
import { issuesOf, prompt, SCHEMA, SYSTEM, type SenseInfo } from "./check.ts";

const MODEL = Deno.env.get("EXAMPLE_MODEL") ?? "claude-haiku-5-5";
/** Model calls per request, and failed requests per sense, before giving up. */
const TRIES_PER_REQUEST = 2;
const MAX_FAILED_REQUESTS = 3;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
let anthropic: Anthropic | null = null;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Ex = { nl: string; en: string; targetSpans: [number, number][]; source: string };

// deno-lint-ignore no-explicit-any
type Json = any;

/** The sense as the model needs it, from the published word. */
function senseInfo(word: Json, use: Json, sense: Json): SenseInfo {
  const forms: string[] = [word.form, ...(use.forms ?? []).map((f: Json) => f.form)];
  if (use.pattern && use.headForms) for (const f of use.headForms) forms.push(`${f} ${use.governs}`);
  return {
    form: word.form,
    pos: use.pos,
    gloss: sense.gloss,
    glossNote: sense.glossNote,
    article: use.pos === "noun" ? (sense.article ?? use.article) : undefined,
    forms,
    otherGlosses: use.senses.filter((s: Json) => s !== sense).map((s: Json) => s.gloss),
  };
}

async function write(info: SenseInfo): Promise<{ example?: Omit<Ex, "source">; issue?: string }> {
  anthropic ??= new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  let issue = "no answer";
  for (let i = 0; i < TRIES_PER_REQUEST; i++) {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt(info) }],
    });
    if (message.stop_reason === "refusal") return { issue: "refused" };
    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    let answer: Json;
    try {
      answer = JSON.parse(text);
    } catch {
      issue = "bad JSON";
      continue;
    }
    const { issues, nl, en, span } = issuesOf(answer, info.forms);
    if (!issues.length && span) return { example: { nl, en, targetSpans: [span] } };
    issue = issues.join(", ");
  }
  return { issue };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let senseId: unknown;
  try {
    ({ senseId } = await req.json());
  } catch {
    return json(400, { error: "Body must be JSON: { senseId }" });
  }
  if (typeof senseId !== "string" || !/^s_[A-Za-z0-9_-]{4,64}$/.test(senseId)) return json(400, { error: "senseId must be a dictionary sense id" });

  const done = await admin.from("dict_generated_examples").select("nl, en").eq("sense_id", senseId).maybeSingle();
  if (done.data) return json(200, { nl: done.data.nl, en: done.data.en, targetSpans: [], source: "generated" });

  const row = await admin.from("dict_senses").select("word_id").eq("id", senseId).maybeSingle();
  if (!row.data) return json(422, { error: "No such sense" });
  const wordRow = await admin.from("dict_words").select("data").eq("id", row.data.word_id).maybeSingle();
  const word: Json = wordRow.data?.data;
  const use = word?.uses?.find((u: Json) => u.senses.some((s: Json) => s.id === senseId));
  const sense = use?.senses.find((s: Json) => s.id === senseId);
  if (!sense) return json(422, { error: "No such sense" });

  const existing = (sense.examples ?? []).find((e: Json) => e.nl?.trim() && e.en?.trim());
  if (existing) return json(200, existing);

  const tried = await admin.from("dict_example_attempts").select("attempts").eq("sense_id", senseId).maybeSingle();
  if ((tried.data?.attempts ?? 0) >= MAX_FAILED_REQUESTS) return json(422, { error: "No example could be written for this sense" });

  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json(503, { error: "Example writing is not configured" });

  const info = senseInfo(word, use, sense);
  let result: Awaited<ReturnType<typeof write>>;
  try {
    result = await write(info);
  } catch (e) {
    console.error(e);
    // The API's status (401 key, 429 rate, 529 overloaded) — never the key.
    const status = e instanceof Anthropic.APIError ? e.status : "unreachable";
    return json(502, { error: `Example writing failed (${status})` });
  }

  if (!result.example) {
    await admin.from("dict_example_attempts").upsert({
      sense_id: senseId,
      attempts: (tried.data?.attempts ?? 0) + 1,
      last_issue: result.issue,
      updated_at: new Date().toISOString(),
    });
    return json(422, { error: `No example passed the checks (${result.issue})` });
  }

  // Two learners asking at once both get a sentence; the first one stored
  // is the one everyone sees from then on.
  await admin.from("dict_generated_examples").upsert(
    { sense_id: senseId, form: info.form, pos: info.pos, gloss: info.gloss, nl: result.example.nl, en: result.example.en, model: MODEL },
    { onConflict: "sense_id", ignoreDuplicates: true }
  );
  const stored = await admin.from("dict_generated_examples").select("nl, en").eq("sense_id", senseId).maybeSingle();
  const winner = stored.data ?? result.example;
  return json(200, {
    nl: winner.nl,
    en: winner.en,
    targetSpans: winner.nl === result.example.nl ? result.example.targetSpans : [],
    source: "generated",
  });
});

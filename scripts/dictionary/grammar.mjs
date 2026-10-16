/* Settles the frequent grammar disagreements in the doubt queue — where
   English and Dutch Wiktionary give a different article, plural, past
   participle or past singular, which keeps the use out of the dictionary.

     node scripts/dictionary/grammar.mjs   (after a build; needs ANTHROPIC_API_KEY)

   Two models answer independently, each choosing among the values the
   sources give (or "unsure"); only where they agree is a line proposed, in
   OUT_DIR/grammar.tsv (form, pos, field, from, value). Nothing is applied
   until a person copies the lines to data/corrections/grammar.tsv; the
   build then uses the value only if it is still one the sources give
   (assemble.mjs). A past singular is only ever confirmed, never changed:
   its plural would have to change with it. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runBatch } from "./llm.mjs";
import { OUT_DIR } from "./paths.mjs";

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"];
const FIELDS = { "article: sources disagree": "article", "plural: sources disagree": "plural", "participle: sources disagree": "participle", "pastSg: sources disagree": "pastSg" };
const LABEL = { article: "article (de/het)", plural: "plural", participle: "past participle", pastSg: "past tense, singular" };
const log = (m) => console.log(m);

const doubtFile = join(OUT_DIR, "doubt.jsonl");
if (!existsSync(doubtFile)) throw new Error(`no ${doubtFile}: run the build first`);
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const items = [];
for (const line of readFileSync(doubtFile, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const d = JSON.parse(line);
  const field = FIELDS[d.reason];
  if (!field || d.priority !== "frequent") continue;
  const en = list(d.detail?.enWiktionary);
  const nl = list(d.detail?.nlWiktionary);
  let choices;
  if (field === "article") {
    const set = new Set([...en, ...nl].flatMap((a) => (a === "de/het" ? ["de", "het"] : [a])));
    choices = [...set];
    if (set.has("de") && set.has("het")) choices.push("de/het");
  } else choices = [...new Set([...en, ...nl])];
  if (choices.length < 2) continue;
  // The build looks a settled value up by English Wiktionary's value.
  items.push({ form: d.word, pos: d.pos, field, from: field === "plural" ? en.join(", ") : en[0], choices, senses: list(d.detail?.senses) });
}
log(`${items.length} frequent grammar disagreements`);
if (!items.length) process.exit(0);

const SYSTEM = `You are an expert in Standard Dutch (Netherlands) grammar, as in the Woordenlijst (Groene Boekje) and Van Dale.
Given a Dutch word and two or more candidate values for one grammatical form, choose the value that is correct in today's standard Dutch for the word in the meaning given.
- For an article, answer "de/het" only when both are genuinely standard for this meaning.
- Answer "unsure" when you are not certain, when the right value is not among the candidates, or when it depends on a meaning not given.`;

const requests = MODELS.flatMap((model, m) =>
  items.map((it, i) => ({
    custom_id: `m${m}-${i}`,
    params: {
      model,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object", properties: { value: { type: "string", enum: [...it.choices, "unsure"] } }, required: ["value"], additionalProperties: false } } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Word: ${it.form} (${it.pos})${it.senses.length ? `\nMeaning: ${it.senses.slice(0, 4).join("; ")}` : ""}\nForm: ${LABEL[it.field]}\nCandidates: ${it.choices.join(" | ")}` }],
    },
  }))
);
const results = await runBatch(requests, log);

const rows = [];
const tally = { agreed: 0, disagreed: 0, unsure: 0 };
items.forEach((it, i) => {
  const [a, b] = MODELS.map((_, m) => results.get(`m${m}-${i}`)?.value);
  if (!a || !b || a === "unsure" || b === "unsure") return tally.unsure++;
  if (a !== b) return tally.disagreed++;
  if (it.field === "pastSg" && a !== it.from) return tally.disagreed++;
  tally.agreed++;
  rows.push([it.form, it.pos, it.field, it.from, a, it.choices.join(" | ")]);
});
writeFileSync(join(OUT_DIR, "grammar.tsv"), ["# form\tpos\tfield\tfrom\tvalue\tcandidates", ...rows.map((r) => r.join("\t"))].join("\n") + "\n");
log(`grammar: ${tally.agreed} agreed, ${tally.disagreed} disagreed, ${tally.unsure} unsure → grammar.tsv`);

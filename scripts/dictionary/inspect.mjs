/* Prints built words compactly: `node scripts/dictionary/inspect.mjs was bal`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR } from "./paths.mjs";

const want = new Set(process.argv.slice(2));
const lines = readFileSync(join(OUT_DIR, "words.jsonl"), "utf8").split("\n").filter(Boolean);
for (const line of lines) {
  const w = JSON.parse(line);
  if (want.size && !want.has(w.form)) continue;
  console.log(`■ ${w.form}  [${w.kind}] freq=${w.frequency} ${w.variants.length ? "variants=" + w.variants.join("|") : ""}${w.compound ? " compound=" + JSON.stringify(w.compound, ["form", "link", "left", "right"]) : ""}${w.opaque ? " OPAQUE" : ""}${w.morphemes ? " morphemes=" + w.morphemes.map((m) => m.text + ":" + m.type).join(" ") : ""}${w.syllables ? " stress=" + w.syllables.parts.map((p, i) => (i === w.syllables.stressed ? p.toUpperCase() : p)).join("·") : ""}`);
  for (const u of w.uses) {
    const g = ["article", "plural", "plural2", "present3sg", "pastSg", "pastPl", "participle", "auxiliary", "separableSplit", "stress", "expansion", "pattern", "head", "governs", "comparative", "superlative", "inflected", "digit", "person", "function"]
      .filter((k) => u[k] !== undefined)
      .map((k) => `${k}=${typeof u[k] === "object" ? JSON.stringify(u[k]) : u[k]}${u.fieldMeta[k] ? "(" + u.fieldMeta[k].confidence[0] + ")" : ""}`);
    console.log(`  ▸ ${u.id} ${u.subtype} ${g.join(" ")} ${u.present ? "present=" + u.present.map((p) => p.person + " " + p.form).join(", ") : ""}`);
    for (const s of u.senses) {
      const flags = [s.article && "art=" + s.article, s.plural && "pl=" + s.plural, s.variety !== "NL" && s.variety, s.register, s.domain, s.glossNote && `note="${s.glossNote}"`, s.cognate && "cognate", s.synonyms.length && "syn=" + s.synonyms.join("|")].filter(Boolean).join(" ");
      console.log(`     ${s.rank}. ${s.gloss}  {${s.meta.confidence}} ${flags}`);
      for (const e of s.examples) console.log(`        “${e.nl}” — ${e.en} [${e.origin}] spans=${JSON.stringify(e.targetSpans)}`);
    }
  }
}

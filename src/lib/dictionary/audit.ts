/* The dictionary's completeness, counted — what `npm run dictionary:audit`
   reports for a build (and CI for the fixture).

   validate.mjs fails a build over anything WRONG. This counts what is
   MISSING, which a build may legitimately publish as a declared gap — a
   sense with no example ships with "Example coming soon", a noun whose
   sources disagree on de/het with "Article not verified yet" — so the gaps
   are visible, and the words learners meet most are fixed first:

     example         a sense with no example sentence
     exampleEn       an example with no English translation
     gloss           a sense with no English gloss
     article         a noun with no article at all (a declared gap)
     articleChecked  a noun whose article is single-source, not verified
     pos             a use with no part of speech

   Pure: words in, counts out. */
import type { WordEntry } from "./model";

export type Gap = "example" | "exampleEn" | "gloss" | "article" | "articleChecked" | "pos";

export interface AuditReport {
  words: number;
  senses: number;
  nouns: number;
  /** Senses (or nouns, or uses) with each gap. */
  gaps: Record<Gap, number>;
  /** Senses carrying an example, by where it came from. */
  exampleSources: Record<string, number>;
  /** The most frequent words with a gap (lowest frequency rank first) —
   *  where filling one helps the most learners. */
  priority: { form: string; frequency: number; gaps: Gap[] }[];
}

export function auditDictionary(words: WordEntry[], { top = 25 } = {}): AuditReport {
  const gaps: Record<Gap, number> = { example: 0, exampleEn: 0, gloss: 0, article: 0, articleChecked: 0, pos: 0 };
  const exampleSources: Record<string, number> = {};
  const incomplete: AuditReport["priority"] = [];
  let senses = 0;
  let nouns = 0;
  for (const w of words) {
    const own = new Set<Gap>();
    const note = (g: Gap) => {
      gaps[g]++;
      own.add(g);
    };
    for (const u of w.uses) {
      if (!u.pos) note("pos");
      const noun = u.pos === "noun" && w.kind !== "properNoun";
      if (noun) {
        nouns++;
        if (!u.article && u.senses.every((s) => !s.article)) note("article");
        else if (u.fieldMeta?.article?.confidence !== "verified") note("articleChecked");
      }
      for (const s of u.senses) {
        senses++;
        if (!s.gloss?.trim()) note("gloss");
        if (!s.examples.length) note("example");
        else {
          const ex = s.examples[0];
          const source = ex.source === "corpus" ? ex.origin ?? "corpus" : ex.source;
          exampleSources[source] = (exampleSources[source] ?? 0) + 1;
        }
        if (s.examples.some((e) => !e.en?.trim() && e.source !== "captured")) note("exampleEn");
      }
    }
    if (own.size) incomplete.push({ form: w.form, frequency: w.frequency, gaps: [...own] });
  }
  // `frequency` is a rank: 1 is the most common word.
  incomplete.sort((a, b) => a.frequency - b.frequency || a.form.localeCompare(b.form));
  return { words: words.length, senses, nouns, gaps, exampleSources, priority: incomplete.slice(0, top) };
}

const pct = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(1)}%` : "—");

/** The report as Markdown, for the workflow summary. */
export function auditMarkdown(r: AuditReport): string {
  const row = (label: string, n: number, of: number) => `| ${label} | ${n} | ${pct(n, of)} |`;
  return [
    `**${r.words} words · ${r.senses} senses · ${r.nouns} nouns**`,
    "",
    "| Missing | Count | Share |",
    "| --- | ---: | ---: |",
    row("Example sentence (sense)", r.gaps.example, r.senses),
    row("Example translation (sense)", r.gaps.exampleEn, r.senses),
    row("English gloss (sense)", r.gaps.gloss, r.senses),
    row("Article (noun, declared gap)", r.gaps.article, r.nouns),
    row("Verified article (noun, single source)", r.gaps.articleChecked, r.nouns),
    row("Part of speech (use)", r.gaps.pos, r.senses),
    "",
    `Examples by source: ${Object.entries(r.exampleSources).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"}`,
    "",
    `Most frequent incomplete words: ${r.priority.map((p) => `${p.form} (${p.gaps.join(", ")})`).join("; ") || "none"}`,
  ].join("\n");
}

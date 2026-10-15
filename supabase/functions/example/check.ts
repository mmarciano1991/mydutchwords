/* The pure half of the "example" function: what the model is asked, and the
   checks its answer must pass. No Deno or network here, so the app's test
   runner covers it (check.test.ts).

   The checks are the cheap mechanical ones the build also runs
   (scripts/dictionary/examples.mjs): the word is in the sentence, the
   sentence is card-sized, the translation is real. Spelling and de/het are
   checked again, against OpenTaal, when the next build folds the sentence
   into the dictionary. */

export interface SenseInfo {
  form: string;
  pos: string;
  gloss: string;
  glossNote?: string;
  article?: string;
  /** Every form the word takes in a sentence (the build's targetForms). */
  forms: string[];
  /** The word's other meanings, which the sentence must not show. */
  otherGlosses: string[];
}

export const MIN_WORDS = 3;
export const MAX_WORDS = 18;

export const SYSTEM = `You write example sentences for a Dutch learner's dictionary.
Write ONE short, natural, everyday Dutch sentence (5-12 words) that uses the given word in exactly the given meaning, and a natural English translation with the same meaning.
- Use standard Netherlands Dutch spelling (Woordenlijst), correct de/het for every noun.
- Use the word itself or one of its inflected forms; do not split a separable verb (write "Ik wil je morgen opbellen", not "Ik bel je op").
- Use only common words besides the given word. No names of people, no brand names, no quotation marks.`;

export function prompt(s: SenseInfo): string {
  return [
    `Word: ${s.article ? `${s.article} ${s.form}` : s.form}`,
    `Part of speech: ${s.pos}`,
    `Meaning: ${s.gloss}${s.glossNote ? ` — ${s.glossNote}` : ""}`,
    `Other meanings NOT to use: ${s.otherGlosses.join("; ") || "none"}`,
  ].join("\n");
}

/** The JSON shape the model must answer in. */
export const SCHEMA = {
  type: "object",
  properties: { nl: { type: "string" }, en: { type: "string" } },
  required: ["nl", "en"],
  additionalProperties: false,
} as const;

const WORD = /[\p{L}\p{M}'’-]+/gu;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** [start, end) of the first form found in `nl` as whole words, or null. */
export function findSpan(nl: string, forms: string[]): [number, number] | null {
  const lower = nl.toLowerCase();
  // Longest first, so "afkomen van" wins over "afkomen".
  for (const form of [...new Set(forms.map((f) => f.trim().toLowerCase()).filter(Boolean))].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRe(form)}(?![\\p{L}\\p{M}])`, "u");
    const m = re.exec(lower);
    if (m) return [m.index, m.index + m[0].length];
  }
  return null;
}

/** What's wrong with the model's answer, or [] when it passes; with the
 *  word's position in the sentence. */
export function issuesOf(answer: { nl?: unknown; en?: unknown }, forms: string[]): { issues: string[]; nl: string; en: string; span: [number, number] | null } {
  const nl = typeof answer.nl === "string" ? answer.nl.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  const en = typeof answer.en === "string" ? answer.en.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  const issues: string[] = [];
  const words = nl.match(WORD) ?? [];
  if (words.length < MIN_WORDS) issues.push("too short");
  if (words.length > MAX_WORDS) issues.push("too long");
  if (!/\p{L}{2}/u.test(en)) issues.push("no translation");
  if (/["“”„[\]{}|<>\n]/.test(nl)) issues.push("markup or quotes in sentence");
  const span = nl ? findSpan(nl, forms) : null;
  if (!span) issues.push("word not found in sentence");
  return { issues, nl, en, span };
}

/* The mechanical gate on generated dictionary content.
 *
 * scripts/complete-entries.mjs asks a model to fill the gaps the dictionary
 * can now name — missing articles, meanings with no example sentence, examples
 * that don't use their own word. This module decides what is even allowed to
 * reach a human reviewer.
 *
 * It lives here, in the app's own source, rather than inside the script, for
 * two reasons: it can be unit-tested, and it can reuse `deinflect` — the same
 * morphology the app uses to look words up. "Does this sentence use this word"
 * is not a substring question in Dutch ("gaan" is demonstrated by "Ik ga naar
 * huis"), and a checker that got that wrong would reject correct sentences and
 * wave through wrong ones.
 *
 * The bar is deliberately high. A reviewer's attention is the scarce resource,
 * and the failure this whole pipeline is built around — a wrong meaning that
 * arrives looking exactly like a right one — is one a tired reviewer waves
 * through. Anything that fails here never gets the chance.
 */
import { deinflect } from "./deinflect";
import type { Gender } from "./types";

/** What the model is asked to produce for one word. */
export interface Proposal {
  dutch: string;
  /** The model's own answer to "are you sure": false means it declined. */
  confident: boolean;
  article: string;
  example: string;
  exampleEn: string;
}

/** What was asked for, so the answer can be checked against the question. */
export interface ProposalRequest {
  dutch: string;
  /** The specific meaning the example is supposed to demonstrate. */
  gloss: string;
}

const VALID_ARTICLES: readonly string[] = ["de", "het", "none"];

/** Words in a Dutch sentence, lowercased. Keeps the accented letters Dutch
 *  borrows ("café", "privé") and the apostrophe of "auto's". */
function tokenize(sentence: string): string[] {
  return sentence.toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
}

/** True when `sentence` contains `word` in any inflected form. */
export function sentenceUsesWord(sentence: string, word: string): boolean {
  const target = word.toLowerCase();
  return tokenize(sentence).some(
    (token) => token === target || deinflect(token, (candidate) => candidate === target).length > 0
  );
}

/**
 * Every reason this proposal must not reach a reviewer. An empty array means
 * it passed; the proposal still needs a person to approve it before it can
 * ship (see scripts/promote-generated.mjs).
 */
export function checkProposal(proposal: Proposal, request: ProposalRequest): string[] {
  const problems: string[] = [];
  const dutch = String(proposal.dutch ?? "").toLowerCase();
  const expected = request.dutch.toLowerCase();

  // A batched request can come back misaligned; an answer attributed to the
  // wrong word would put one word's example under another word's entry.
  if (dutch !== expected) {
    problems.push(`answered for "${proposal.dutch}", not "${request.dutch}"`);
  }

  // The model was asked to decline rather than guess. Taking it at its word
  // is the cheapest accuracy win available here.
  if (!proposal.confident) problems.push("model was not confident");

  const example = String(proposal.example ?? "").trim();
  const exampleEn = String(proposal.exampleEn ?? "").trim();

  if (!example) problems.push("no example sentence");
  if (!exampleEn) problems.push("no English translation");

  // Tabs and newlines are the field separators in the generated dictionary
  // encoding — one would corrupt every entry after it.
  if (/[\t\n\r]/.test(`${example}${exampleEn}`)) problems.push("contains a tab or newline");

  if (!VALID_ARTICLES.includes(proposal.article)) {
    problems.push(`article "${proposal.article}" is not de, het or none`);
  }

  // The check that carries the most weight: an example that doesn't contain
  // its own word demonstrates nothing, and is the exact defect this pipeline
  // was partly built to repair.
  if (example && dutch && !sentenceUsesWord(example, dutch)) {
    problems.push("example does not contain the word");
  }

  // Self-contradiction: the article claimed here versus the article the
  // model's own sentence uses. Same rule the build applies to the human-
  // authored dictionary, where it found three real errors.
  if (example && dutch && proposal.article !== "none") {
    const escaped = dutch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const used = example.toLowerCase().match(new RegExp(`\\b(de|het)\\s+${escaped}\\b`));
    if (used && used[1] !== proposal.article) {
      problems.push(`article "${proposal.article}" contradicts its own example ("${used[1]} ${dutch}")`);
    }
  }

  // A single meaning per sense. Letting a packed gloss back in would undo the
  // splitting that made meanings addressable in the first place.
  if (request.gloss.includes(";")) {
    problems.push("the requested meaning still packs several meanings into one gloss");
  }

  return problems;
}

/** The article as the app's own type, once a proposal has passed. */
export function articleOf(proposal: Proposal): Gender {
  return proposal.article === "de" || proposal.article === "het" ? proposal.article : "none";
}

/* Stored examples — sentences written once for senses no corpus covers,
   kept in the repository (data/examples/*.tsv) and reused by every build.

   One line per sense:  form <TAB> pos <TAB> gloss <TAB> nl <TAB> en
   The key is the sense as a learner sees it (form, part of speech, gloss),
   not its id, so a line survives a rebuild that renumbers senses. A line
   whose sense no longer exists is simply unused.

   Nothing here is trusted: the build runs every stored sentence through the
   same checks as a Wiktionary or Tatoeba one (examples.mjs exampleIssues),
   and uses it only for a sense that got no corpus example. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./paths.mjs";

export const STORED_DIR = join(ROOT, "data", "examples");

export const storedKey = (form, pos, gloss) => `${form.normalize("NFC")}\t${pos}\t${gloss.normalize("NFC").trim()}`;

/** Examples written on demand by the "example" Edge Function, pulled from
 *  dict_generated_examples before a build (publish.mjs --pull-registry),
 *  in the same line format. Kept in the build's output directory. */
export const GENERATED_FILE = "generated-examples.tsv";

function readLines(path, file, out) {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [form, pos, gloss, nl, en] = line.split("\t");
    if (!form || !pos || !gloss || !nl?.trim() || !en?.trim()) continue;
    out.set(storedKey(form, pos, gloss), { nl: nl.normalize("NFC").trim(), en: en.normalize("NFC").trim(), file });
  }
}

/** key → { nl, en, file } for every stored line. Later files win, and the
 *  repository's files win over on-demand ones (`generated`, when given). */
export function loadStoredExamples(dir = STORED_DIR, generated) {
  const out = new Map();
  if (generated && existsSync(generated)) readLines(generated, GENERATED_FILE, out);
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsv")).sort()) readLines(join(dir, file), file, out);
  return out;
}

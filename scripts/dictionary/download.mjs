/* Step 1 of the dictionary pipeline: download the sources into a local cache.

   Every source is open data and is fetched fresh on each CI build, so the
   dictionary is reproducible from this script alone. Files already in the
   cache are kept unless --force is passed. */
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { join } from "node:path";
import { CACHE_DIR } from "./paths.mjs";

export const SOURCES = [
  // English Wiktionary, Dutch entries: gender, plurals, verb forms, senses.
  { file: "en-wiktionary-dutch.jsonl.gz", url: "https://kaikki.org/dictionary/Dutch/kaikki.org-dictionary-Dutch.jsonl.gz" },
  // Dutch Wiktionary: a second, independent source for gender and forms,
  // and the Dutch explanations (explanationNl).
  { file: "nl-wiktionary.jsonl.gz", url: "https://kaikki.org/nlwiktionary/Nederlands/kaikki.org-dictionary-Nederlands.jsonl.gz" },
  // OpenTaal: the official spelling list (Woordenlijst-based).
  { file: "opentaal-wordlist.txt", url: "https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/wordlist.txt" },
  // Frequency: OpenSubtitles 2018, top 50k word forms.
  { file: "nl-frequency.txt", url: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/nl/nl_50k.txt" },
  // Tatoeba: real NL sentences with EN translations.
  { file: "tatoeba-nld.tsv.bz2", url: "https://downloads.tatoeba.org/exports/per_language/nld/nld_sentences.tsv.bz2" },
  { file: "tatoeba-eng.tsv.bz2", url: "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2" },
  { file: "tatoeba-nld-eng-links.tsv.bz2", url: "https://downloads.tatoeba.org/exports/per_language/nld/nld-eng_links.tsv.bz2" },
];

async function download({ file, url }, force) {
  const target = join(CACHE_DIR, file);
  if (!force && existsSync(target) && statSync(target).size > 0) {
    console.log(`cached  ${file}`);
    return;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  console.log(`fetched ${file} (${(statSync(target).size / 1e6).toFixed(1)} MB)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const force = process.argv.includes("--force");
  for (const source of SOURCES) await download(source, force);
}

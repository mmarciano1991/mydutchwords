/* Extracts the test fixture from a real build: the words behind every
   acceptance case (§13 of the spec), plus whatever their lookups, prefixes
   and compound splits reach. The tests run against real pipeline output,
   not hand-written data — regenerate after a build with
   `npm run dictionary:fixture`. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, ROOT } from "./paths.mjs";
import { searchKey, confusionKey } from "../../src/lib/dictionary/normalize.ts";
import { candidateSegments } from "../../src/lib/dictionary/compound.ts";

/** Exact lookups the tests make. */
const TERMS = [
  "was", "ben", "kan", "moet", "ga", "liep", "deed", "zijn", "kunnen", "moeten", "gaan", "lopen", "doen", "wassen",
  "net", "vrij", "bank", "teer", "kras", "bal", "aanslag", "toeslag", "opzeggen", "beschikking", "termijn", "bon",
  "bel", "op", "opbellen", "bellen", "komt", "aan", "aankomen", "komen", "heb", "zin", "in", "koffie", "zin hebben",
  "hebben", "wachten", "wachten op", "bus", "ik", "je", "morgen", "de", "trein", "om", "acht", "uur", "we",
  "belasting", "huur", "huurtoeslag", "aanvraag", "zeehond", "hond", "zee", "ziekenhuis", "boterham",
  "invoer", "uitvoer", "voer", "uit", "Schiphol", "tunnel", "GGD", "test", "ziektekostenverzekering", "premie",
  "bos", "uil", "bosuil", "kerkhof", "stadhuis", "zout", "baby", "meisje", "wond", "filter", "huizen", "huis",
  "BSN", "AOW", "i.p.v.", "zzp'er", "vaardigheid", "factor", "hygiëne", "paraplu", "IJsselmeer", "auto's", "auto",
  "klein", "ijzer", "een", "één", "voorkomen", "gestegen", "stijgen", "gisteren", "van", "bedrijf", "medewerker",
  "leider", "medewerkers", "leiders", "sauna", "opgeven", "geven", "huis", "aardappel",
  // Onboarding: starter pools (lib/starterWords) and the words its tests type.
  "gemeente", "brief", "rekening", "aanmelden", "afspraak", "huisarts", "apotheek", "kassa",
  "vergadering", "collega", "vertraging", "ophalen", "fiets",
];
/** Compounds the tests split — every segment's key is included. */
const COMPOUNDS = ["belastingaanslag", "huurtoeslagaanvraag", "Schipholtunnel", "GGD-test", "ziektekostenverzekeringspremie", "bosuil", "bedrijfsmedewerkers", "bedrijfsleiders", "invoer", "uitvoer"];
/** Prefixes the autocomplete tests type. */
const PREFIXES = ["belasting", "huur", "liep", "klijn", "yzer"];
/** Typos the tests type: every word sharing their confusion key. */
const TYPOS = ["klijn", "yzer", "hygiene", "ijsselmeer", "autos", "zzper"];

const words = new Map();
for (const line of readFileSync(join(OUT_DIR, "words.jsonl"), "utf8").split("\n")) {
  if (!line) continue;
  const w = JSON.parse(line);
  words.set(w.id, w);
}
const keys = readFileSync(join(OUT_DIR, "keys.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const wanted = new Set();
const exact = new Set([...TERMS, ...TYPOS].map(searchKey));
for (const c of COMPOUNDS) for (const s of candidateSegments(c)) exact.add(s);
for (const k of keys) {
  if (exact.has(k.key) || PREFIXES.some((p) => k.key.startsWith(searchKey(p)))) wanted.add(k.wordId);
}
const canons = new Set(TYPOS.map(confusionKey));
for (const w of words.values()) if (canons.has(confusionKey(w.form))) wanted.add(w.id);
// Compound parts of included words.
const walk = (n) => {
  if (!n) return;
  if (n.wordId) wanted.add(n.wordId);
  walk(n.left);
  walk(n.right);
};
for (const id of [...wanted]) walk(words.get(id)?.compound);

const NOISY = ["archaic", "dated", "subjunctive", "with-gij", "majestic", "Flanders", "obsolete", "dialectal"];
const out = {
  note: "Extracted from a real dictionary build by scripts/dictionary/fixture.mjs. Do not edit by hand.",
  build: JSON.parse(readFileSync(join(OUT_DIR, "report.json"), "utf8")).startedAt,
  /** Built with the model step (--llm): the acceptance cases that need it run. */
  llm: Boolean(JSON.parse(readFileSync(join(OUT_DIR, "report.json"), "utf8")).llm),
  words: [...wanted].map((id) => words.get(id)).filter(Boolean).map((w) => ({
    ...w,
    uses: w.uses.map((u) => ({ ...u, forms: u.forms.filter((f) => !f.tags.some((t) => NOISY.includes(t))) })),
  })),
  keys: keys.filter((k) => wanted.has(k.wordId)),
};
const target = join(ROOT, "src", "lib", "dictionary", "fixture.json");
writeFileSync(target, JSON.stringify(out));
console.log(`fixture: ${out.words.length} words, ${out.keys.length} keys → ${target}`);

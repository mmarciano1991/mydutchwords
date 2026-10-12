/* OpenTaal word list — the official spelling (based on the Woordenlijst).
   A headword that isn't in it is not published: that is what keeps
   "vaardighed", "paraply" and "faktor" out. */
import { join } from "node:path";
import { eachLine } from "../io.mjs";
import { CACHE_DIR } from "../paths.mjs";

export async function loadOpenTaal() {
  const exact = new Set();
  const lower = new Map(); // lower case → official form(s)
  await eachLine(join(CACHE_DIR, "opentaal-wordlist.txt"), (line) => {
    const w = line.normalize("NFC").trim();
    if (!w) return;
    exact.add(w);
    const l = w.toLowerCase();
    const list = lower.get(l);
    if (list) list.push(w);
    else lower.set(l, [w]);
  });
  return {
    size: exact.size,
    /** The exact spelling is official. */
    has: (w) => exact.has(w),
    /** Any capitalisation is official — for words inside a sentence. */
    hasAnyCase: (w) => exact.has(w) || lower.has(w.toLowerCase()),
    /** Official spellings of a word regardless of case ("bsn" → ["BSN"]). */
    officialForms: (w) => lower.get(w.toLowerCase()) ?? [],
  };
}

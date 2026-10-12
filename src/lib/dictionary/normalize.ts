/* ──────────────────────────────────────────────────────────────────────────
   Spelling normalization — the same rules on the server (the build
   pipeline writes `searchKey`) and on the client (the query is keyed the
   same way before it is sent).

   A word has its official form, always displayed, and a search key, used
   only to find it:

     hygiëne / hygiene        → hygiene      (diacritics off)
     IJsselmeer / ijsselmeer  → ijsselmeer   (lower case; ĳ ligature = ij)
     auto's / autos           → autos        (apostrophes off — any of ’‘`´)
     e-mail / email           → email        (hyphens and spaces off)
     i.p.v. / ipv             → ipv          (abbreviation dots off)

   Pure, no imports: the Node pipeline imports this file directly.
   ────────────────────────────────────────────────────────────────────────── */

/** Every apostrophe-like character a phone keyboard or a pasted text uses. */
const APOSTROPHES = /[’‘`´ʼ′]/g;

/** Unicode NFC, with apostrophe variants unified to ' — the official form
 *  as it should be stored and displayed. */
export function canonicalForm(text: string): string {
  return text.normalize("NFC").replace(APOSTROPHES, "'").replace(/\s+/g, " ").trim();
}

/** Strips diacritics: hygiëne → hygiene, één → een, café → cafe. The ĳ
 *  ligature decomposes to "ij" on the way (NFKD). */
export function foldDiacritics(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Punctuation that never belongs to a word at its edges — from pasted
 *  text ("termijn," "(huur)"). An apostrophe is kept at the start ('s
 *  ochtends) and the end (a plural like "auto's" never ends in one, but
 *  "'t" does start with one). A dot is kept at the end only when the word
 *  has another dot inside it (i.p.v.). */
export function stripEdgePunctuation(text: string): string {
  let t = canonicalForm(text);
  t = t.replace(/^[^\p{L}\p{N}']+/u, "");
  const keepDot = /\.\p{L}/u.test(t);
  t = keepDot ? t.replace(/[^\p{L}\p{N}'.]+$/u, "") : t.replace(/[^\p{L}\p{N}']+$/u, "");
  return t;
}

/** The search key: lower case, no diacritics, no apostrophes, hyphens,
 *  spaces or dots. Two spellings with the same key are the same search. */
export function searchKey(text: string): string {
  return foldDiacritics(canonicalForm(text))
    .toLowerCase()
    .replace(/['\-\s.]/g, "");
}

/** True when the text is worth searching: at least `min` letters once
 *  keyed. */
export function isSearchable(text: string, min = 2): boolean {
  return searchKey(text).length >= min;
}

/* ── Learner confusions ──────────────────────────────────────────────────
   The canonical key behind "Did you mean…?": spellings a learner confuses
   collapse to one shape, so "klijn" and "klein", "yzer" and "ijzer" share
   it. Used for candidate lookup and for the reduced edit cost (lib
   dictionary/fuzzy). */
export function confusionKey(text: string): string {
  let k = searchKey(text);
  k = k.replace(/ij|y/g, "ei"); // ei/ij, and y typed for ij
  k = k.replace(/au/g, "ou"); // ou/au
  k = k.replace(/ch/g, "g"); // g/ch
  k = k.replace(/(aa|ee|oo|uu)/g, (m) => m[0]); // double vowels
  k = k.replace(/([bcdfghjklmnpqrstvwxz])\1/g, "$1"); // double consonants
  k = k.replace(/d$/, "t"); // final -d/-t
  return k;
}

/** Highlights for "the typed prefix" in a suggestion: the length of `form`
 *  (as displayed) that covers `query`'s key. 0 when `form` doesn't start
 *  with the query. Display characters that the key ignores (apostrophes,
 *  hyphens, accents) are walked over, so "autos" highlights "auto's". */
export function prefixLength(form: string, query: string): number {
  const q = searchKey(query);
  if (!q) return 0;
  let matched = 0;
  for (let i = 0; i < form.length; i++) {
    const k = searchKey(form[i]);
    if (!k) continue; // ignored by the key (apostrophe, hyphen, space)
    if (q.startsWith(k, matched)) {
      matched += k.length;
      if (matched >= q.length) return i + 1;
    } else {
      return 0;
    }
  }
  return 0;
}

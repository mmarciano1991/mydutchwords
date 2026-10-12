/* The digit for a written Dutch numeral — computed from the spelling, not
   looked up: "eenentwintig" is 21 by the rules of the language.
   Cardinals up to 9999 and their ordinals; anything else is undefined. */

const UNITS = { nul: 0, een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9 };
const TEENS = { tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18, negentien: 19 };
const TENS = { twintig: 20, dertig: 30, veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80, negentig: 90 };

function below100(w) {
  if (w in UNITS) return UNITS[w];
  if (w in TEENS) return TEENS[w];
  if (w in TENS) return TENS[w];
  const m = w.match(/^(\p{L}+?)(?:en|ën)(\p{L}+)$/u); // eenentwintig, tweeëntwintig
  if (m && m[1] in UNITS && m[2] in TENS && UNITS[m[1]] > 0) return UNITS[m[1]] + TENS[m[2]];
  return undefined;
}

function below1000(w) {
  const direct = below100(w);
  if (direct !== undefined) return direct;
  const m = w.match(/^(\p{L}*?)honderd(\p{L}*)$/u);
  if (!m) return undefined;
  const h = m[1] === "" ? 1 : UNITS[m[1]];
  const rest = m[2] === "" ? 0 : below100(m[2]);
  if (h === undefined || rest === undefined) return undefined;
  return h * 100 + rest;
}

function cardinal(w) {
  const direct = below1000(w);
  if (direct !== undefined) return direct;
  const m = w.match(/^(\p{L}*?)duizend(\p{L}*)$/u);
  if (!m) return undefined;
  const t = m[1] === "" ? 1 : below100(m[1]);
  const rest = m[2] === "" ? 0 : below1000(m[2]);
  if (t === undefined || rest === undefined) return undefined;
  return t * 1000 + rest;
}

const ORDINAL_IRREGULAR = { eerste: 1, derde: 3, achtste: 8 };

export function numeralValue(form) {
  const w = form.toLowerCase().trim();
  const c = cardinal(w);
  if (c !== undefined) return { value: c, ordinal: false };
  if (w in ORDINAL_IRREGULAR) return { value: ORDINAL_IRREGULAR[w], ordinal: true };
  const m = w.match(/^(\p{L}+?)(ste|de)$/u);
  if (m) {
    const base = cardinal(m[1]) ?? cardinal(m[1] + "e") ?? cardinal(m[1].replace(/en$/, "")) ;
    if (base !== undefined) return { value: base, ordinal: true };
  }
  return undefined;
}

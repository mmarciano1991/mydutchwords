/* ──────────────────────────────────────────────────────────────────────────
   Compounds — splitting a Dutch compound the dictionary doesn't hold into
   parts it does.

   The whole word always beats decomposition: this only runs once the word
   itself was not found, and it only ever splits into VERIFIED parts —
   whatever `lookup` answers for. A compound is saved and studied as a
   whole; the split explains it, never replaces it.

     belastingaanslag      belasting + s + aanslag   (head gives de, -en)
     bosuil                bos + uil                 (never bo + suil)
     GGD-test              GGD (acronym, kept) + test
     Schipholtunnel        Schiphol (a name, not translated) + tunnel
     huurtoeslagaanvraag   huurtoeslag + aanvraag    (sub-parts on demand)

   Joints allowed between parts: none, -s-, -en-, -e-, -er- and a hyphen.
   Nothing else is ever invented. Several valid splits: fewest parts, then
   the longest head, then the most frequent parts.

   Pure: callers fetch the candidate segments first (candidateSegments) and
   answer `lookup` synchronously.
   ────────────────────────────────────────────────────────────────────────── */
import type { CompoundNode, WordKind } from "./model.ts";
import { searchKey } from "./normalize.ts";

/** What the dictionary knows about one candidate part. */
export interface PartInfo {
  /** The dictionary word this segment is (its lemma, for an inflected head). */
  wordId: string;
  form: string;
  kind: WordKind;
  frequency: number;
  /** The segment is the lemma itself, not an inflected form of it. */
  isLemma: boolean;
}

export type PartLookup = (segmentKey: string) => PartInfo | undefined;

/** Joints, in order of preference — "" first, so a plain join wins a tie. */
export const JOINTS = ["", "s", "en", "e", "er"] as const;

/** Shortest part. Three letters keeps bos + uil and stops "bo + suil". */
const MIN_PART = 3;
/** Nothing shorter is worth splitting. */
const MIN_WORD = 6;

interface Best {
  node: CompoundNode;
  leaves: number;
  headLength: number;
  freqSum: number;
  jointCost: number;
}

/** Every segment of `word` a split could need, as search keys — fetch these
 *  in one batch, then call decomposeCompound. */
export function candidateSegments(word: string): string[] {
  const out = new Set<string>();
  for (const piece of word.split("-")) {
    const k = searchKey(piece);
    if (!k) continue;
    for (let i = 0; i < k.length; i++) {
      for (let j = i + MIN_PART; j <= k.length; j++) out.add(k.slice(i, j));
    }
  }
  return [...out];
}

function better(a: Best | null, b: Best | null): Best | null {
  if (!a) return b;
  if (!b) return a;
  if (a.leaves !== b.leaves) return a.leaves < b.leaves ? a : b;
  if (a.headLength !== b.headLength) return a.headLength > b.headLength ? a : b;
  if (a.jointCost !== b.jointCost) return a.jointCost < b.jointCost ? a : b;
  return a.freqSum <= b.freqSum ? a : b;
}

const JOINT_COST: Record<string, number> = { "": 0, s: 1, en: 1, er: 2, e: 3, "-": 0 };

/** The best split of `word` into known parts, or null. `word` is the
 *  written form (capitals matter: a capitalised first part that the
 *  dictionary doesn't know is taken as a name). */
export function decomposeCompound(word: string, lookup: PartLookup): CompoundNode | null {
  const written = word.trim();
  if (searchKey(written).length < MIN_WORD && !written.includes("-")) return null;

  // A hyphen is a written joint: split there first (GGD-test, zee-egel).
  if (written.includes("-")) {
    const at = written.lastIndexOf("-");
    const leftText = written.slice(0, at);
    const rightText = written.slice(at + 1);
    const right = resolveSegment(rightText, true, lookup, written) ?? bestSplit(rightText, true, lookup, new Map());
    const left = resolveSegment(leftText, false, lookup, written) ?? bestSplit(leftText, false, lookup, new Map());
    if (!left || !right) return null;
    return { form: written, link: "-", componentKind: "lemma", left: left.node, right: right.node };
  }

  const best = bestSplit(written, true, lookup, new Map());
  if (!best || best.leaves < 2) return null;
  return best.node;
}

/** A segment as one part: a known word, or (the first part only) a
 *  capitalised name or an acronym the dictionary doesn't hold. */
function resolveSegment(text: string, isHead: boolean, lookup: PartLookup, whole: string): Best | null {
  const key = searchKey(text);
  if (key.length < MIN_PART && !/^\p{Lu}{2,}$/u.test(text)) return null;
  const info = lookup(key);
  if (info && (isHead || info.isLemma)) {
    const componentKind = info.kind === "properNoun" ? "properNoun" : info.kind === "abbreviation" ? "abbreviation" : "lemma";
    return {
      node: { form: text, componentKind, wordId: info.wordId },
      leaves: 1,
      headLength: key.length,
      freqSum: info.frequency,
      jointCost: 0,
    };
  }
  // Not in the dictionary, but plainly a name (capitalised at the start of
  // the written word) or an acronym (all capitals): kept as is, never
  // translated. Never the head — the head carries the meaning.
  if (!isHead && whole.startsWith(text)) {
    if (/^\p{Lu}{2,}$/u.test(text)) {
      return { node: { form: text, componentKind: "abbreviation" }, leaves: 1, headLength: 0, freqSum: 1e6, jointCost: 1 };
    }
    if (/^\p{Lu}\p{Ll}{2,}$/u.test(text)) {
      return { node: { form: text, componentKind: "properNoun" }, leaves: 1, headLength: 0, freqSum: 1e6, jointCost: 2 };
    }
  }
  return null;
}

function bestSplit(text: string, isHead: boolean, lookup: PartLookup, memo: Map<string, Best | null>): Best | null {
  const memoKey = `${isHead ? "H" : "M"}:${text}`;
  if (memo.has(memoKey)) return memo.get(memoKey)!;
  let best: Best | null = null;

  // Splits into left (modifier) + joint + right (head). The left side is
  // tried as a single known part first, then recursively.
  for (let i = MIN_PART; i <= text.length - MIN_PART; i++) {
    const leftText = text.slice(0, i);
    for (const joint of JOINTS) {
      if (!text.toLowerCase().startsWith(joint, i)) continue;
      const rightText = text.slice(i + joint.length);
      if (searchKey(rightText).length < MIN_PART) continue;
      const right = resolveSegment(rightText, isHead, lookup, text) ?? bestSplit(rightText, isHead, lookup, memo);
      if (!right) continue;
      const left = resolveSegment(leftText, false, lookup, text) ?? bestSplit(leftText, false, lookup, memo);
      if (!left) continue;
      const candidate: Best = {
        node: { form: text, link: joint, componentKind: "lemma", left: left.node, right: right.node },
        leaves: left.leaves + right.leaves,
        headLength: right.headLength,
        freqSum: left.freqSum + right.freqSum,
        jointCost: left.jointCost + right.jointCost + JOINT_COST[joint],
      };
      best = better(best, candidate);
    }
  }
  memo.set(memoKey, best);
  return best;
}

/** The leaves of a compound tree, left to right, with the joint that
 *  follows each. */
export function compoundParts(node: CompoundNode): { form: string; link: string; node: CompoundNode }[] {
  if (!node.left || !node.right) return [{ form: node.form, link: "", node }];
  const left = compoundParts(node.left);
  left[left.length - 1].link = node.link ?? "";
  return [...left, ...compoundParts(node.right)];
}

/** The two main parts (the top split) — what the card shows first; deeper
 *  parts open on demand. */
export function mainParts(node: CompoundNode): CompoundNode[] {
  return node.left && node.right ? [node.left, node.right] : [node];
}

/** The head: the rightmost leaf, which gives article and plural. */
export function headOf(node: CompoundNode): CompoundNode {
  let n = node;
  while (n.right) n = n.right;
  return n;
}

// ── Abbreviated coordination ──

/** "in- en uitvoer", "zon- en feestdagen", "bedrijfsleiders en
 *  -medewerkers": a shared part written once. Resolves each to the full
 *  word, or null when the text isn't that shape or the full words can't be
 *  verified. The original text is kept by the caller as context; "in-" on
 *  its own is never an entry. */
export function resolveAbbreviatedCoordination(
  text: string,
  options: {
    /** The written word's own split into modifier (joint included) and
     *  head — from its dictionary entry or decomposeCompound. */
    splitHead: (word: string) => { modifier: string; head: string } | null;
    /** True when a word is in the dictionary or splits into known parts. */
    isKnownOrDecomposable: (word: string) => boolean;
  }
): { full: [string, string] } | null {
  const { splitHead, isKnownOrDecomposable } = options;
  const t = text.trim();
  // First part abbreviated: "X- en|of|tot Y" — X takes Y's head.
  let m = t.match(/^(\p{L}+)-\s+(en|of|tot|en\/of)\s+(\p{L}+)$/u);
  if (m) {
    const [, x, , y] = m;
    const split = splitHead(y);
    const heads = split ? [split.head] : [];
    // Without a recorded split: longest head first.
    if (!split) for (let i = 1; i <= y.length - MIN_PART; i++) heads.push(y.slice(i));
    for (const head of heads) {
      const candidate = x + head;
      if (isKnownOrDecomposable(candidate)) return { full: [candidate, y] };
    }
    return null;
  }
  // Last part abbreviated: "X en|of -Y" — Y takes X's modifier.
  m = t.match(/^(\p{L}+)\s+(en|of|tot|en\/of)\s+-(\p{L}+)$/u);
  if (m) {
    const [, x, , y] = m;
    const split = splitHead(x);
    if (!split) return null;
    const candidate = split.modifier + y;
    if (isKnownOrDecomposable(candidate)) return { full: [x, candidate] };
  }
  return null;
}

/** A compound's modifier (with joint) and head, as written. */
export function splitAtHead(node: CompoundNode): { modifier: string; head: string } | null {
  if (!node.left || !node.right) return null;
  const head = node.right.form;
  return { modifier: node.form.slice(0, node.form.length - head.length), head };
}

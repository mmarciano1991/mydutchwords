/* WordParts — how a word is built, shown with the context sentence after
   an answer, for compounds and separable (or prefixed) verbs.

   Each part is coloured by type AND labelled in words — separable prefix
   (blue), inseparable prefix (purple), on- (orange), suffix (green), root
   (neutral) — and the stressed syllable is underlined. For a compound, the
   two main parts. */
import type { MorphemeType, SenseSnapshot } from "../lib/dictionary/model";
import { mainParts } from "../lib/dictionary/compound";

const LABEL: Record<MorphemeType, string> = {
  separablePrefix: "separable prefix",
  inseparablePrefix: "inseparable prefix",
  on: "negative on-",
  root: "root",
  suffix: "suffix",
};

/** The word with its stressed syllable underlined. */
function Stressed({ snapshot }: { snapshot: SenseSnapshot }) {
  const syl = snapshot.syllables;
  if (!syl) return null;
  return (
    <span className="word-parts__stress" lang="nl" aria-label={`Stress on “${syl.parts[syl.stressed]}”`}>
      {syl.parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true">·</span>}
          {i === syl.stressed ? <u className="word-parts__stressed">{p}</u> : p}
        </span>
      ))}
    </span>
  );
}

export function WordParts({ snapshot }: { snapshot: SenseSnapshot }) {
  const morphemes = snapshot.morphemes;
  const compound = snapshot.compound;
  const showMorphemes = morphemes && morphemes.length > 1 && (snapshot.pos === "verb" || morphemes.some((m) => m.type !== "root"));
  if (!showMorphemes && !compound && !snapshot.syllables) return null;
  return (
    <div className="word-parts">
      {showMorphemes ? (
        <ul className="word-parts__list" aria-label="Word parts">
          {morphemes!.map((m, i) => (
            <li key={i} className={`word-part word-part--${m.type}`}>
              <span className="word-part__text" lang="nl">
                {m.text}
              </span>
              <span className="word-part__label">{LABEL[m.type]}</span>
            </li>
          ))}
        </ul>
      ) : compound ? (
        <ul className="word-parts__list" aria-label="Word parts">
          {mainParts(compound).map((p, i, all) => (
            <li key={i} className="word-part word-part--root">
              <span className="word-part__text" lang="nl">
                {p.form}
              </span>
              <span className="word-part__label">{i === all.length - 1 ? "main word" : "describes it"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Stressed snapshot={snapshot} />
    </div>
  );
}

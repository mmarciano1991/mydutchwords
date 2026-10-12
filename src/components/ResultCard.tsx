/* ResultCard — one sense of a looked-up word (Figma result_card 443:2861:
   "Single find", "multiple-find", "alreadyin").

   Word with its article written in front ("de aardappel"), gloss, an
   optional grammar explanation, and the part-of-speech pill on the right.
   The control on the left decides the action:

     add        Single find — exactly one addable sense: one tap adds it
     checkbox   multiple-find — two or more addable senses: tap toggles
     inDeck     alreadyin — in the deck: no action, green card, a check
                mark, solid pill; "In your deck" for assistive tech

   The grammar explanation says why the word differs from what was typed
   ("Past tense of lopen.") and is left out entirely when there is none.

   One real button/checkbox per card — never a button in a button. */
import { useId } from "react";
import type { SenseSnapshot } from "../lib/dictionary/model";
import { genderOf } from "../lib/dictionary/snapshot";
import { Add, CheckCircle } from "../icons";
import { InfoPill, sensePills } from "./InfoPill";
import { PosPill } from "./PosPill";

export type ResultControl = "add" | "checkbox" | "inDeck";

/** The word as the card writes it: "de aardappel", "de/het bal", "lopen". */
export function articledForm(sense: Pick<SenseSnapshot, "form" | "pos" | "article">): string {
  const gender = genderOf(sense);
  return gender === "de" || gender === "het" || gender === "de/het" ? `${gender} ${sense.form}` : sense.form;
}

export function ResultCard({
  sense,
  control,
  grammar,
  checked = false,
  disabled = false,
  onAdd,
  onToggle,
}: {
  sense: SenseSnapshot;
  control: ResultControl;
  /** One line on how the typed form relates to this word. */
  grammar?: string;
  checked?: boolean;
  disabled?: boolean;
  onAdd?: () => void;
  onToggle?: (checked: boolean) => void;
}) {
  const glossId = useId();
  const word = articledForm(sense);
  const inDeck = control === "inDeck";
  const pills = sensePills(sense);
  const unverified = sense.pos === "noun" && sense.articleUnverified;

  return (
    <div className={`result-card${inDeck ? " result-card--indeck" : ""}${checked && control === "checkbox" ? " result-card--checked" : ""}`}>
      {control === "add" && (
        <button
          type="button"
          className="result-card__control icon-btn icon-btn--ghost"
          onClick={onAdd}
          disabled={disabled}
          aria-label={`Add ${word}, ${sense.gloss}, to your deck`}
        >
          <Add />
        </button>
      )}
      {control === "checkbox" && (
        <label className="result-card__control result-card__checkbox">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onToggle?.(e.target.checked)}
            aria-describedby={glossId}
            aria-label={word}
          />
          <span className="checkbox-box" aria-hidden="true" />
        </label>
      )}
      {inDeck && (
        <span className="result-card__control result-card__done" aria-hidden="true">
          <CheckCircle />
        </span>
      )}

      <div className="result-card__body">
        <div className="result-card__main">
          <div className="result-card__head">
            <span className="result-card__word" lang="nl">
              {word}
              {unverified && <span className="sr-only"> (article not verified yet)</span>}
            </span>
            <span className="result-card__gloss" id={glossId} lang="en">
              {sense.gloss}
              {sense.glossNote && <span className="result-card__note"> — {sense.glossNote}</span>}
            </span>
          </div>
          {inDeck && <span className="sr-only">In your deck</span>}
          {grammar && <p className="result-card__grammar">{grammar}</p>}
          {unverified && !inDeck && <span className="result-card__hint">Article not verified yet</span>}
          {pills.length > 0 && (
            <span className="result-card__pills">
              {pills.map((p) => (
                <InfoPill key={p} kind={p} />
              ))}
            </span>
          )}
        </div>
        <PosPill pos={sense.pos} tone={inDeck ? "solid" : "default"} />
      </div>
    </div>
  );
}

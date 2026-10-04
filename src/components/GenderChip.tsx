import type { Gender } from "../lib/types";

/** The article chip.
 *
 *  de = filled chip, het = inset-outlined chip (per the Delft Blue design).
 *
 *  "unknown" gets a chip of its own rather than rendering as nothing. That is
 *  the whole point of separating it from "none": otherwise a noun whose
 *  article nobody has established looks identical to a verb that never needs
 *  one, and the gap is invisible to the learner and uncountable for everyone
 *  else.
 *  Showing it turns a silent hole into something a learner can see — and,
 *  through Edit translation, fix.
 *
 *  "none" still renders nothing, because there is nothing to say: the word
 *  genuinely takes no article. */
export function GenderChip({ gender, size = "md" }: { gender: Gender; size?: "sm" | "md" }) {
  const small = size === "sm" ? " chip--sm" : "";

  if (gender === "de" || gender === "het") {
    return <span className={`chip chip--${gender}${small}`}>{gender}</span>;
  }

  if (gender === "unknown") {
    return (
      <span
        className={`chip chip--unknown${small}`}
        title="We don't know whether this word takes de or het yet"
      >
        de/het?
      </span>
    );
  }

  return null;
}

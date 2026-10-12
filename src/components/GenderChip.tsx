import type { Gender } from "../lib/types";

/** The article chip.
 *
 *  Two looks: the classic (de filled, het outlined) used on practice cards,
 *  and `soft` (light blue, serif — Figma result_card / dictionary_card) used
 *  in search results and the deck.
 *
 *  "de/het" is a real double (de/het filter) and shows as such. "unknown"
 *  — a noun whose article nobody has established — gets a "de/het?" chip
 *  rather than nothing, so the gap is visible; "none" (not a noun) renders
 *  nothing. `unverified`: the article comes from one source only; the chip
 *  says so to assistive tech and the card says it in words. */
export function GenderChip({
  gender,
  size = "md",
  tone = "classic",
  unverified = false,
}: {
  gender: Gender;
  size?: "sm" | "md";
  tone?: "classic" | "soft";
  unverified?: boolean;
}) {
  if (gender === "none") return null;
  const classes = ["chip", tone === "soft" ? "chip--soft" : "", size === "sm" ? "chip--sm" : ""];
  const label = gender === "unknown" ? "de/het?" : gender;
  if (gender === "de" || gender === "het") classes.push(`chip--${gender}`);
  else classes.push("chip--unknown");
  if (unverified) classes.push("chip--unverified");
  const title =
    gender === "unknown"
      ? "We don't know whether this word takes de or het yet"
      : gender === "de/het"
        ? "Both de and het are used"
        : unverified
          ? "Article not verified yet"
          : undefined;
  return (
    <span className={classes.filter(Boolean).join(" ")} title={title} lang="nl">
      {label}
      {unverified && gender !== "unknown" && <span className="sr-only"> (article not verified yet)</span>}
    </span>
  );
}

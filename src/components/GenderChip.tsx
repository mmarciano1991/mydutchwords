import type { Gender } from "../lib/types";

/** de = filled chip, het = inset-outlined chip (per the Delft Blue design). */
export function GenderChip({ gender, size = "md" }: { gender: Gender; size?: "sm" | "md" }) {
  if (gender !== "de" && gender !== "het") return null;
  const cls = `chip chip--${gender}${size === "sm" ? " chip--sm" : ""}`;
  return <span className={cls}>{gender}</span>;
}

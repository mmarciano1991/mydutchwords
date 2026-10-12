/* PosPill — the part-of-speech pill on result and deck cards (Figma
   result_card "Badge"). Green on a found result, solid green when the
   sense is already in the deck. Text, not colour, carries the meaning. */
import { POS_LABEL, type Pos } from "../lib/dictionary/model";

export function PosPill({ pos, tone = "default" }: { pos: Pos | string; tone?: "default" | "solid" }) {
  const label = POS_LABEL[pos as Pos] ?? pos.charAt(0).toUpperCase() + pos.slice(1);
  return <span className={`pos-pill${tone === "solid" ? " pos-pill--solid" : ""}`}>{label}</span>;
}

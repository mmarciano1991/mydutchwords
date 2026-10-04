// The glyph for each daily-amount preset (Espresso / Ontbijt / Diner),
// from the Figma icon set. Paints with `currentColor`.
import type { Commitment } from "../lib/habit";
import { BakeryDining, DinnerDining, LocalCafe, type IconProps } from "../icons";

const ICONS = {
  espresso: LocalCafe,
  ontbijt: BakeryDining,
  diner: DinnerDining,
} satisfies Record<Commitment, (props: IconProps) => JSX.Element>;

export function CommitmentIcon({ commitment, ...rest }: { commitment: Commitment } & IconProps) {
  const Glyph = ICONS[commitment];
  return <Glyph {...rest} />;
}

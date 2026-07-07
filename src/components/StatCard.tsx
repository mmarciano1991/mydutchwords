/* StatCard — a big number over a label, in a bordered tile (Figma node
   154:604, "Card"). Used for the session report's Knew it / To review
   counts. `tone` picks the number's colour. */
export type StatCardTone = "success" | "error";

export function StatCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: StatCardTone;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-card__value stat-card__value--${tone}`}>{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}

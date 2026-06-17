import { TulipMedallion } from "../components/brand";

export function PracticeSummary({
  correct,
  total,
  onAgain,
  onHome,
}: {
  correct: number;
  total: number;
  onAgain: () => void;
  onHome: () => void;
}) {
  const praise =
    correct === total ? "Uitstekend!" : correct >= total / 2 ? "Mooi gedaan!" : "Goed geprobeerd!";

  return (
    <div className="screen pad-top">
      <div className="screen__body center-col gutter" style={{ padding: "34px 26px 10px", flex: 1 }}>
        <TulipMedallion size={104} />
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 31, fontWeight: 600, color: "var(--text-display)", marginTop: 18 }}>
          {praise}
        </div>
        <p className="muted" style={{ fontSize: 14.5, margin: "6px 0 0" }}>
          Session complete · progress saved automatically
        </p>

        <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 24 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 66, fontWeight: 600, color: "var(--primary)", lineHeight: 1 }}>
            {correct}
          </span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "#9DB0CB" }}>
            / {total}
          </span>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          words you knew
        </div>
      </div>

      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", flexDirection: "column", gap: 9 }}>
        <button className="btn btn--primary" onClick={onAgain}>
          Practice again
        </button>
        <button className="btn btn--secondary" onClick={onHome}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

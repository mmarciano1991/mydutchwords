/* ProgressBar — a full-width track with a filled leading segment and a
   caption beneath it (Figma node 304:1081; variants 304:1075 "default" and
   304:1198 "inverted").

   This is the *deck-level* progress indicator ("2/248 mastered") — distinct
   from `MasteryBar`, which is the small per-word ladder chip. `inverted` is
   the version that sits on a dark (blue-900) surface: a slimmer track and a
   light, smaller caption. */
export type ProgressBarVariant = "default" | "inverted";

export function ProgressBar({
  value,
  max,
  label,
  variant = "default",
}: {
  /** Completed count. Clamped into 0…max. */
  value: number;
  /** Total the bar fills up to. */
  max: number;
  /** Caption under the bar. Defaults to `value/max`. */
  label?: string;
  variant?: ProgressBarVariant;
}) {
  const total = Math.max(0, max);
  const done = Math.max(0, Math.min(total, value));
  const pct = total > 0 ? (done / total) * 100 : 0;
  const caption = label ?? `${done}/${total}`;

  return (
    <div className={`progressbar progressbar--${variant}`}>
      <div
        className="progressbar__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={caption}
      >
        <div className="progressbar__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progressbar__label">{caption}</p>
    </div>
  );
}

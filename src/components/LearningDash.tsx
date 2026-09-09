/* LearningDash — the two-up session scoreboard (Figma node 311:1256,
   "leaning_dash"): the "I knew it" and "Still learning" counts side by side
   on navy chips. The compact, dark-surface counterpart to `StatCard`, which
   is the bordered light-card version used on the session report. */
export function LearningDash({
  known,
  learning,
  knownLabel = "I knew it",
  learningLabel = "Still learning",
}: {
  /** Cards answered correctly this session. */
  known: number;
  /** Cards still to review. */
  learning: number;
  knownLabel?: string;
  learningLabel?: string;
}) {
  return (
    <div className="learning-dash">
      <div className="learning-dash__tile">
        <span className="learning-dash__value learning-dash__value--known">{known}</span>
        <span className="learning-dash__label">{knownLabel}</span>
      </div>
      <div className="learning-dash__tile">
        <span className="learning-dash__value learning-dash__value--learning">{learning}</span>
        <span className="learning-dash__label">{learningLabel}</span>
      </div>
    </div>
  );
}

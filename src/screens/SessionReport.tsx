/* SessionReport — the result screen, and the mandatory last step of every
   practice sitting (Figma node 133:245).

   Every completed sitting lands here, however it went: the day's set or a
   re-drill, a perfect run or an all-wrong one. It is the only place the
   flow can end, and only the user leaving it returns them to the dashboard
   — nothing navigates past it on their behalf.

   It reads the same run the dashboard's practice card reads, so the two can
   never disagree about what just happened. */
import { isLeech } from "../lib/learningEngine";
import type { DeckItem } from "../lib/types";
import { resolveEntry } from "../lib/wordSources";
import { Badge } from "../components/Badge";
import { StatCard } from "../components/StatCard";
import { WordRowCompact } from "../components/WordRowCompact";

export function SessionReport({
  knownIds,
  learningIds,
  deck,
  streak,
  warmup = false,
  onReviewMissed,
  onBackToDashboard,
}: {
  /** Words answered "I knew it" in the sitting that just ended. */
  knownIds: string[];
  /** Words answered "Still learning" in it. */
  learningIds: string[];
  /** For the leech tag on the review list. */
  deck: DeckItem[];
  /** Consecutive practice days including this sitting. */
  streak: number;
  /** Warm-up: answers were recorded but the schedule wasn't moved. */
  warmup?: boolean;
  onReviewMissed: () => void;
  onBackToDashboard: () => void;
}) {
  const total = knownIds.length + learningIds.length;
  const toReview = learningIds.length;
  const perfect = total > 0 && toReview === 0;
  const byId = new Map(deck.map((d) => [d.id, d]));

  return (
    <div className="screen pad-top">
      <div className="screen__body gutter" style={{ paddingTop: 22, paddingBottom: 8 }}>
        <div style={{ textAlign: "center" }}>
          <Badge>
            {total} word{total === 1 ? "" : "s"} practised
          </Badge>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              fontWeight: 600,
              color: "var(--text-display)",
              marginTop: 14,
            }}
          >
            {perfect ? "Helemaal goed!" : "Goed bezig!"}
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "7px 0 0" }}>
            {warmup ? "Extra practice — your schedule didn’t change." : "A quick check-in — not a grade."}
          </p>
          {streak > 1 && (
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--caution-solid)", margin: "9px 0 0" }}>
              🔥 {streak}-day streak — five minutes a day adds up.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <StatCard value={knownIds.length} label="Knew it" tone="success" />
          <StatCard value={toReview} label="To review" tone="error" />
        </div>

        {toReview > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                margin: "18px 2px 11px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-display)",
                }}
              >
                Words to review
              </span>
              <span className="faint" style={{ fontSize: 12.5 }}>
                {warmup ? "Not rescheduled" : "Coming back sooner"}
              </span>
            </div>
            {/* Full list — the screen body scrolls, so nothing is dead-ended. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {learningIds.map((id) => {
                const entry = resolveEntry(id);
                if (!entry) return null;
                const item = byId.get(id);
                return (
                  <WordRowCompact
                    key={id}
                    dutch={entry.dutch}
                    english={entry.english}
                    gender={entry.gender}
                    tricky={item ? isLeech(item) : false}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Leaving is always offered, and is the primary action once there is
          nothing left to drill — this screen carries no tab bar and no
          close, so it must never be a dead end. */}
      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", flexDirection: "column", gap: 9 }}>
        {toReview > 0 && (
          <button className="btn btn--primary" onClick={onReviewMissed}>
            Practise {toReview === 1 ? "it" : `these ${toReview}`} again
          </button>
        )}
        {toReview > 0 ? (
          <button
            className="link-btn"
            style={{ margin: "5px auto 0", display: "block" }}
            onClick={onBackToDashboard}
          >
            Back to dashboard
          </button>
        ) : (
          <button className="btn btn--primary" onClick={onBackToDashboard}>
            Back to dashboard
          </button>
        )}
      </div>
    </div>
  );
}

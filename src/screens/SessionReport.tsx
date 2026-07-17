/* SessionReport — "Batch complete" check-in shown after a practice session
   (Figma node 133:245). Missed words were already retried in-session (see
   Practice) and rescheduled sooner by the ladder; from here the user can
   move on to the next batch and/or drill the missed words again right now.
   The footer adapts to what's actually left: both actions, just one, or —
   once the deck is fully caught up — a way back to the dashboard. */
import { isLeech, type SessionReport as EngineSessionReport } from "../lib/learningEngine";
import { resolveEntry } from "../lib/wordSources";
import { Badge } from "../components/Badge";
import { StatCard } from "../components/StatCard";
import { WordRowCompact } from "../components/WordRowCompact";

export function SessionReport({
  report,
  streak,
  warmup = false,
  nextCount,
  onContinue,
  onReviewMissed,
  onBackToDashboard,
}: {
  report: EngineSessionReport;
  /** Consecutive practice days including this session. */
  streak: number;
  /** Warm-up session: nothing was persisted or rescheduled. */
  warmup?: boolean;
  /** Size of the next batch the scheduler would build right now (0 = none left). */
  nextCount: number;
  onContinue: () => void;
  onReviewMissed: () => void;
  onBackToDashboard: () => void;
}) {
  const toReview = report.dontKnowWords.length;
  const hasNext = nextCount > 0;
  const hasReview = toReview > 0;

  return (
    <div className="screen pad-top">
      <div className="screen__body gutter" style={{ paddingTop: 22, paddingBottom: 8 }}>
        <div style={{ textAlign: "center" }}>
          <Badge>Batch of {report.totalReviewed} done</Badge>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              fontWeight: 600,
              color: "var(--text-display)",
              marginTop: 14,
            }}
          >
            Goed bezig!
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "7px 0 0" }}>
            {warmup ? "Warm-up — your schedule didn\u2019t change." : "A quick check-in — not a grade."}
          </p>
          {streak > 1 && (
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--caution-solid)", margin: "9px 0 0" }}>
              🔥 {streak}-day streak — five minutes a day adds up.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <StatCard value={report.knownCount} label="Knew it" tone="success" />
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
              {report.dontKnowWords.map((word) => {
                const entry = resolveEntry(word.id);
                if (!entry) return null;
                return (
                  <WordRowCompact
                    key={word.id}
                    dutch={entry.dutch}
                    english={entry.english}
                    gender={entry.gender}
                    tricky={isLeech(word)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", flexDirection: "column", gap: 9 }}>
        {hasNext && (
          <button className="btn btn--primary" onClick={onContinue}>
            Continue to next {nextCount}
          </button>
        )}
        {hasReview && (
          <button className={`btn ${hasNext ? "btn--secondary" : "btn--primary"}`} onClick={onReviewMissed}>
            Review missed words
          </button>
        )}
        {!hasNext && !hasReview && (
          <button className="btn btn--primary" onClick={onBackToDashboard}>
            Back to dashboard
          </button>
        )}
      </div>
    </div>
  );
}

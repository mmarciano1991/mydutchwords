/* SessionReport — "Batch complete" check-in shown after a practice session
   (Figma node 133:245). Purely informational: missed words were already
   retried in-session (see Practice) and rescheduled sooner by the ladder;
   the one continuation action is moving on to the next batch. */
import { SESSION_CAP, type SessionReport as EngineSessionReport } from "../lib/learningEngine";
import { resolveEntry } from "../lib/wordSources";
import { Badge } from "../components/Badge";
import { StatCard } from "../components/StatCard";
import { WordRowCompact } from "../components/WordRowCompact";

const VISIBLE_REVIEW_WORDS = 3;

export function SessionReport({
  report,
  streak,
  onContinue,
}: {
  report: EngineSessionReport;
  /** Consecutive practice days including this session. */
  streak: number;
  onContinue: () => void;
}) {
  const toReview = report.dontKnowWords.length;
  const visible = report.dontKnowWords.slice(0, VISIBLE_REVIEW_WORDS);
  const overflow = toReview - visible.length;

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
            A quick check-in — not a grade.
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
                Coming back sooner
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {visible.map((word, i) => {
                const entry = resolveEntry(word.id);
                if (!entry) return null;
                const last = i === visible.length - 1;
                return (
                  <div key={word.id} style={{ position: "relative" }}>
                    <WordRowCompact dutch={entry.dutch} english={entry.english} gender={entry.gender} />
                    {last && overflow > 0 && (
                      <span
                        className="faint"
                        style={{
                          position: "absolute",
                          right: 16,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        +{overflow} more
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="gutter" style={{ padding: "12px 22px 32px", display: "flex", flexDirection: "column", gap: 9 }}>
        <button className="btn btn--primary" onClick={onContinue}>
          Continue to next {SESSION_CAP}
        </button>
      </div>
    </div>
  );
}

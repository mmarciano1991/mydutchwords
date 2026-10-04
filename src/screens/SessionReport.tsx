/* SessionReport — the result screen, and the mandatory last step of every
   practice sitting (Figma node 133:245).

   Its job in the habit loop is to close the day: say clearly that today is
   DONE, show what was actually gained (the new words met), and place the day
   in the week. The primary action is to finish — "Done" — not to keep going.
   Extra practice and re-drills are offered as quiet text links underneath,
   and an extra round says outright that tomorrow's goal is unchanged.

   When the monthly reflection is due, it takes the primary slot here: right
   after the goal is reached is when "look how far you've come" lands.

   It reads the same run the dashboard does, so the two can never disagree
   about what just happened. */
import { isLeech } from "../lib/learningEngine";
import type { TodayProgress, WeekProgress } from "../lib/habit";
import type { DeckItem } from "../lib/types";
import { resolveEntry } from "../lib/wordSources";
import { Badge } from "../components/Badge";
import { StatCard } from "../components/StatCard";
import { WeekGoalStatus } from "../components/WeekGoalStatus";
import { WordRowCompact } from "../components/WordRowCompact";

export type SittingKind = "goal" | "extra" | "warmup";

export function SessionReport({
  knownIds,
  learningIds,
  deck,
  kind,
  today,
  week,
  newToday,
  tomorrow,
  reflectionReady,
  canExtra,
  onReviewMissed,
  onExtra,
  onReflection,
  onDone,
}: {
  /** Words answered "I knew it" in the sitting that just ended. */
  knownIds: string[];
  /** Words answered "Still learning" in it. */
  learningIds: string[];
  /** For the leech tag on the review list. */
  deck: DeckItem[];
  /** goal = toward today's goal; extra = past it; warmup = an ungraded re-drill. */
  kind: SittingKind;
  today: TodayProgress;
  week: WeekProgress;
  /** Dutch words practised for the very first time today. */
  newToday: string[];
  /** "at 08:00" — completes "See you tomorrow …". */
  tomorrow: string;
  /** The monthly "then vs now" is due and has something to show. */
  reflectionReady: boolean;
  canExtra: boolean;
  onReviewMissed: () => void;
  onExtra: () => void;
  onReflection: () => void;
  onDone: () => void;
}) {
  const total = knownIds.length + learningIds.length;
  const toReview = learningIds.length;
  const byId = new Map(deck.map((d) => [d.id, d]));

  const dayJustDone = kind === "goal" && today.done;
  const title = dayJustDone ? "Done for today!" : kind === "extra" ? "Extra ✓" : "Nice work!";
  const sub = dayJustDone
    ? `That’s today’s Dutch. See you tomorrow ${tomorrow}.`
    : kind === "extra"
      ? `A bonus — tomorrow is still just ${today.goal} words.`
      : kind === "warmup"
        ? "Extra practice — your schedule didn’t change."
        : `${today.goal - today.towardGoal} to go for today.`;

  return (
    <div className="screen pad-top">
      <div className="screen__body gutter" style={{ paddingTop: 22, paddingBottom: 8 }}>
        <div style={{ textAlign: "center" }}>
          <Badge>
            {dayJustDone ? "Today’s goal ✓" : `${total} word${total === 1 ? "" : "s"} practised`}
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
            {title}
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "7px 0 0" }}>
            {sub}
          </p>
        </div>

        {/* What was gained, by name — the most meaningful thing a session
            produces is a word the learner didn't have this morning. */}
        {newToday.length > 0 && (
          <div className="report-new">
            <p className="report-new__label">
              New today
            </p>
            <ul className="report-new__words">
              {newToday.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="report-week">
          <WeekGoalStatus week={week} card />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <StatCard value={knownIds.length} label="Knew it" tone="success" />
          <StatCard value={toReview} label="Still learning" tone="error" />
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
                Still learning
              </span>
              <span className="faint" style={{ fontSize: 12.5 }}>
                {kind === "warmup" ? "Not rescheduled" : "Coming back sooner"}
              </span>
            </div>
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

      {/* Finishing is always the primary action. Reviewing missed words is a
          secondary button; everything else is a quiet link, so "more" is
          available without being asked for. This screen
          has no tab bar and no close, so it must never be a dead end. */}
      <div className="gutter report-actions">
        {reflectionReady ? (
          <button className="btn btn--primary" onClick={onReflection}>
            See your month in Dutch
          </button>
        ) : (
          <button className="btn btn--primary" onClick={onDone}>
            Done
          </button>
        )}
        {reflectionReady && (
          <button className="link-btn" onClick={onDone}>
            Later
          </button>
        )}
        {toReview > 0 && (
          <button className="btn btn--secondary" onClick={onReviewMissed}>
            Go over {toReview === 1 ? "that one" : `those ${toReview}`} again
          </button>
        )}
        {!reflectionReady && today.done && canExtra && (
          <button className="link-btn" onClick={onExtra}>
            A few more, just for fun
          </button>
        )}
      </div>
    </div>
  );
}

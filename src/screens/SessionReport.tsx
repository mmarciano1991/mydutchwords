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
import { Dock } from "../components/Dock";

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
  nextSectionWords = 0,
  tomorrowReviews = 0,
  canReplay,
  onReviewMissed,
  onExtra,
  onReplay,
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
  /** " at 08:00", or "" without a reminder — completes "See you tomorrow…". */
  tomorrow: string;
  /** The monthly "then vs now" is due and has something to show. */
  reflectionReady: boolean;
  canExtra: boolean;
  /** Words the next section would hold (full section size when available). */
  nextSectionWords?: number;
  /** Reviews already waiting tomorrow — the cost of another section, shown
   *  next to the offer so the learner can pace themselves. */
  tomorrowReviews?: number;
  /** An ungraded "practise again" round is available. */
  canReplay: boolean;
  onReviewMissed: () => void;
  onExtra: () => void;
  onReplay: () => void;
  onReflection: () => void;
  onDone: () => void;
}) {
  const total = knownIds.length + learningIds.length;
  const toReview = learningIds.length;
  const byId = new Map(deck.map((d) => [d.id, d]));

  const dayJustDone = kind === "goal" && today.done;
  const title = dayJustDone ? "Done for today!" : kind === "extra" ? "Extra ✓" : "Nice work!";
  const sub = dayJustDone
    ? `That’s today’s Dutch. See you tomorrow${tomorrow}.`
    : kind === "extra"
      ? `A bonus — tomorrow is still just ${today.goal} words.`
      : kind === "warmup"
        ? "Extra practice — your schedule didn’t change."
        : `${today.goal - today.towardGoal} to go for today.`;

  return (
    <div className="screen pad-top">
      <div className="screen__body gutter report-body">
        <div className="report-head">
          <Badge>
            {dayJustDone ? "Today’s goal ✓" : `${total} word${total === 1 ? "" : "s"} practised`}
          </Badge>
          <div className="report-title">
            {title}
          </div>
          <p className="muted report-sub">
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

        <div className="report-stats">
          <StatCard value={knownIds.length} label="Knew it" tone="success" />
          <StatCard value={toReview} label="Still learning" tone="error" />
        </div>

        {toReview > 0 && (
          <>
            <div className="report-learning__head">
              <span className="report-learning__title">
                Still learning
              </span>
              <span className="faint report-learning__note">
                {kind === "warmup" ? "Not rescheduled" : "Coming back sooner"}
              </span>
            </div>
            <div className="report-learning__list">
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
      <Dock className="gutter report-actions">
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
          <>
            <button className="link-btn" onClick={onExtra}>
              Next section · {nextSectionWords} word{nextSectionWords === 1 ? "" : "s"}
            </button>
            {tomorrowReviews > 0 && (
              <p className="muted report-forecast">
                {tomorrowReviews} review{tomorrowReviews === 1 ? "" : "s"} waiting tomorrow
                {tomorrowReviews > today.goal * 3 ? " — already a big day" : ""}
              </p>
            )}
          </>
        )}
        {/* Nothing left to grade today: words can still be gone over again,
            as many times as the user wants — ungraded, schedule untouched. */}
        {!reflectionReady && !canExtra && canReplay && (
          <button className="link-btn" onClick={onReplay}>
            Practise again
          </button>
        )}
      </Dock>
    </div>
  );
}

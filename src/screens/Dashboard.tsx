/* Dashboard (Figma 300:727) — the home screen. Two blocks: the Insights
   masthead (greeting, counters + progress) pinned to the top, and a single
   PracticeCard below it that says exactly what today asks for. Opening the
   app should never require a decision: the card's one button is the day.

   Everything shown here is derived from synced state (see lib/cloudState),
   so the numbers follow the account rather than the device. */
import { TulipMedallion } from "../components/brand";
import { Insights } from "../components/Insights";
import { PracticeCard } from "../components/PracticeCard";
import type { TodayProgress, WeekProgress } from "../lib/habit";

export function Dashboard({
  deckCount,
  masteredCount,
  today,
  inProgress,
  week,
  streak,
  cue,
  tomorrow,
  canExtra,
  onPractice,
  onExtra,
  onAddWord,
  onOpenWeek,
}: {
  deckCount: number;
  /** Deck words that have reached the top of the ladder. */
  masteredCount: number;
  today: TodayProgress;
  /** Part of today's goal is already done. */
  inProgress: boolean;
  week: WeekProgress;
  /** Consecutive done days. */
  streak: number;
  cue: string;
  tomorrow: string;
  canExtra: boolean;
  /** Starts, or continues, today's goal. */
  onPractice: () => void;
  onExtra: () => void;
  /** Receives the button, so the Add-a-word screen can expand out of it. */
  onAddWord: (origin: HTMLElement) => void;
  /** The calendar counter — opens the Weekly goal screen. */
  onOpenWeek: () => void;
}) {
  // ── Empty deck: only reachable by removing every word (onboarding seeds a
  //    starter deck), so it invites building one back up. ──
  if (deckCount === 0) {
    return (
      <div className="screen pad-top">
        <div className="screen__body center-col gutter intro-body">
          <div className="intro-mark">
            <TulipMedallion />
          </div>
          <div className="display--lg">Woordkast</div>
          <p className="muted intro-text">
            Your deck is empty. Add a Dutch word you met today and it becomes tomorrow&rsquo;s practice.
          </p>
        </div>
        <div className="gutter intro-actions">
          <button className="btn btn--primary" onClick={(e) => onAddWord(e.currentTarget)}>
            Add a word
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__body dashboard">
        <Insights
          deckCount={deckCount}
          masteredCount={masteredCount}
          weekDone={week.done}
          streak={streak}
          onOpenWeek={onOpenWeek}
        />
        <div className="dashboard__spacer">
          <PracticeCard
            status={today.done ? "done" : inProgress ? "progress" : "ready"}
            goal={today.goal}
            towardGoal={today.towardGoal}
            extra={today.extra}
            cue={cue}
            tomorrow={tomorrow}
            canExtra={canExtra}
            onStart={onPractice}
            onExtra={onExtra}
          />
        </div>
      </div>
    </div>
  );
}

/* Dashboard (Figma 300:727) — the home screen. The Insights masthead
   (greeting, counters, words per learning state) pinned to the top, a
   single PracticeCard below it that says exactly what today asks for.
   Opening the app should never require a decision: the card's one button is the day.

   Everything shown here is derived from synced state (see lib/cloudState),
   so the numbers follow the account rather than the device. */
import { TulipMedallion } from "../components/brand";
import { Insights } from "../components/Insights";
import { PracticeCard } from "../components/PracticeCard";
import type { TodayProgress, WeekProgress } from "../lib/habit";
import { Dock } from "../components/Dock";

export function Dashboard({
  deckCount,
  counts,
  today,
  inProgress,
  week,
  streak,
  cue,
  tomorrow,
  canExtra,
  extraWords = 0,
  canReplay,
  onPractice,
  onExtra,
  onReplay,
  onAddWord,
  onOpenWeek,
}: {
  deckCount: number;
  /** Deck words per visible learning state. */
  counts: { new: number; learning: number; learned: number };
  today: TodayProgress;
  /** Part of today's goal is already done. */
  inProgress: boolean;
  week: WeekProgress;
  /** Consecutive done days. */
  streak: number;
  cue: string;
  tomorrow: string;
  canExtra: boolean;
  /** Words the extra practice would hold. */
  extraWords?: number;
  /** An ungraded "practise again" round is available. */
  canReplay: boolean;
  /** Starts, or continues, today's session. */
  onPractice: () => void;
  onExtra: () => void;
  onReplay: () => void;
  /** Receives the button, so the Add-a-word screen can expand out of it. */
  onAddWord: (origin: HTMLElement) => void;
  /** The calendar counter — opens the Weekly goal screen. */
  onOpenWeek: () => void;
}) {
  // ── Empty deck: the first run. Capture-first — nothing is asked before
  //    the first word; this invites adding it. ──
  if (deckCount === 0) {
    return (
      <div className="screen pad-top">
        <div className="screen__body center-col gutter intro-body">
          <div className="intro-mark">
            <TulipMedallion />
          </div>
          <div className="display--lg">Woordkast</div>
          <p className="muted intro-text">
            Add a Dutch word you met today — a sign, a letter, a colleague — and practise it right away.
          </p>
        </div>
        <Dock className="gutter" style={{ paddingBottom: 30 }}>
          <button className="btn btn--primary" onClick={(e) => onAddWord(e.currentTarget)}>
            Add a word
          </button>
        </Dock>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__body dashboard">
        <Insights
          deckCount={deckCount}
          counts={counts}
          weekDone={week.done}
          streak={streak}
          onOpenWeek={onOpenWeek}
        />
        <div className="dashboard__spacer">
          <PracticeCard
            status={today.done ? "done" : inProgress ? "progress" : canExtra ? "ready" : "empty"}
            goal={today.goal}
            towardGoal={today.towardGoal}
            cue={cue}
            tomorrow={tomorrow}
            canExtra={canExtra}
            extraWords={extraWords}
            canReplay={canReplay}
            onStart={onPractice}
            onExtra={onExtra}
            onReplay={onReplay}
          />
        </div>
      </div>
    </div>
  );
}

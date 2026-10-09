/* Insights — the dashboard's header block (Figma 317:1416): a topbar with a
   greeting and two counters (days done this week, current streak), and
   beneath it the deck total split by learning state: New, Learning,
   Learned — each count always carries its text label, never colour alone.

   Everything shown is derived from synced state, so it needs no state of
   its own. */
import { Event, ModeHeat } from "../icons";

/** Greeting for the hour: morning until 12, afternoon until 18. */
function greeting(now: Date): string {
  const h = now.getHours();
  if (h >= 6 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

export function Insights({
  deckCount,
  counts,
  weekDone,
  streak,
  onOpenWeek,
}: {
  /** Words saved in the deck. */
  deckCount: number;
  /** Words per visible learning state. */
  counts: { new: number; learning: number; learned: number };
  /** Days done this week. */
  weekDone: number;
  /** Consecutive done days. */
  streak: number;
  /** The calendar counter opens the Weekly goal screen. */
  onOpenWeek: () => void;
}) {
  return (
    <section className="insights">
      <div className="insights__topbar">
        <p className="insights__greeting">{greeting(new Date())}</p>
        <button
          type="button"
          className="insights__counter insights__counter--week"
          onClick={onOpenWeek}
          aria-label={`${weekDone} day${weekDone === 1 ? "" : "s"} done this week`}
        >
          {weekDone}
          <Event />
        </button>
        <span
          className="insights__counter insights__counter--streak"
          aria-label={`${streak} day streak`}
        >
          {streak}
          <ModeHeat />
        </span>
      </div>

      <div className="insights__hero">
        <p className="insights__stat">
          {deckCount} word{deckCount === 1 ? "" : "s"} in your deck
        </p>
        <div className="insights__progress">
          <p className="insights__eyebrow">Your progress</p>
          <div className="insights__pills">
            <div className="insights__pill insights__pill--new">
              <span className="insights__pill-count">{counts.new}</span>
              <span className="insights__pill-label">New</span>
            </div>
            <div className="insights__pill insights__pill--learning">
              <span className="insights__pill-count">{counts.learning}</span>
              <span className="insights__pill-label">Learning</span>
            </div>
            <div className="insights__pill insights__pill--mastered">
              <span className="insights__pill-count">{counts.learned}</span>
              <span className="insights__pill-label">Learned</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

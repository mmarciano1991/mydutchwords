/* Dashboard (Figma 300:727) — the home screen. Two blocks: the Insights
   masthead pinned to the top, and a single PracticeCard floating in the
   space below it. The bottom navigation is the app shell's, not this
   screen's.

   Everything shown here is derived from the deck and the practice log, both
   of which are synced to the user's Supabase row (see lib/cloudState), so
   the numbers follow the account rather than the device. */
import { TulipMedallion } from "../components/brand";
import { Insights } from "../components/Insights";
import { MIN_PRACTICE_WORDS, PracticeCard } from "../components/PracticeCard";
import type { RunProgress } from "../lib/dailySet";

export function Dashboard({
  deckCount,
  masteredCount,
  setSize,
  progress,
  nextDueLabel,
  streak,
  onPractice,
  onPractiseLearning,
  onPractiseAll,
  onPracticeAhead,
  onAddWord,
}: {
  deckCount: number;
  /** Deck words that have reached the top of the ladder. */
  masteredCount: number;
  /** Words drawn for today — the size of the day, independent of any one
   *  sitting. Drives "N words are ready" and "Practise all N again". */
  setSize: number;
  /** What the user actually did in their current or most recent sitting. */
  progress: RunProgress;
  /** When there was nothing to draw: label for the next unlock, e.g. "tomorrow". */
  nextDueLabel: string | null;
  /** Consecutive practice days. */
  streak: number;
  /** Starts, or resumes, today's set. */
  onPractice: () => void;
  onPractiseLearning: () => void;
  onPractiseAll: () => void;
  onPracticeAhead: () => void;
  /** Receives the button, so the Add-a-word screen can expand out of it. */
  onAddWord: (origin: HTMLElement) => void;
}) {
  // ── Empty deck: invite to build it. There is no progress to report and no
  //    set to practise, so the masthead and the card have nothing to say. ──
  if (deckCount === 0) {
    return (
      <div className="screen pad-top">
        <div className="screen__body center-col gutter" style={{ justifyContent: "center", flex: 1, paddingBottom: 24 }}>
          <div style={{ marginBottom: 26 }}>
            <TulipMedallion />
          </div>
          <div className="display--lg">Woordkast</div>
          <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 20, color: "var(--primary)", margin: "12px 0 0", lineHeight: 1.4 }}>
            Dutch words, kept like fine&nbsp;china.
          </p>
          <p className="muted" style={{ fontSize: 15.5, margin: "18px 0 0", lineHeight: 1.6, maxWidth: 286 }}>
            Capture the Dutch words you meet, then practise them as flashcards.
          </p>
        </div>
        <div className="gutter" style={{ paddingBottom: 30 }}>
          <button className="btn btn--primary" onClick={(e) => onAddWord(e.currentTarget)}>
            Add your first word
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__body dashboard">
        <Insights deckCount={deckCount} masteredCount={masteredCount} streak={streak} />
        <div className="dashboard__spacer">
          <PracticeCard
            // Too thin a deck to practise from outranks everything the run
            // could say; after that, nothing drawn at all is the only state
            // the run can't describe itself.
            status={
              deckCount < MIN_PRACTICE_WORDS
                ? "inactive"
                : setSize === 0
                  ? "caught-up"
                  : progress.status
            }
            deckCount={deckCount}
            setSize={setSize}
            total={progress.total}
            answered={progress.answered}
            knownCount={progress.knownIds.length}
            learningCount={progress.learningIds.length}
            nextDueLabel={nextDueLabel}
            onStart={onPractice}
            onPractiseLearning={onPractiseLearning}
            onPractiseAll={onPractiseAll}
            onPractiseAhead={onPracticeAhead}
            onAddWord={onAddWord}
          />
        </div>
      </div>
    </div>
  );
}

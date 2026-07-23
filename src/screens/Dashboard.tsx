import { TulipMedallion } from "../components/brand";
import { AddWordCard } from "../components/AddWordCard";
import { CheckCircle } from "../icons";

export function Dashboard({
  deckCount,
  dueCount,
  nextDueLabel,
  streak,
  onPractice,
  onPracticeAhead,
  onAddWord,
}: {
  deckCount: number;
  /** Cards the scheduler would put in a session right now (due reviews + new). */
  dueCount: number;
  /** When nothing is due: human label for the next unlock, e.g. "tomorrow". */
  nextDueLabel: string | null;
  /** Consecutive practice days; 0 hides the streak. */
  streak: number;
  onPractice: () => void;
  onPracticeAhead: () => void;
  onAddWord: () => void;
}) {
  // ── Empty deck: invite to build it ──
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
          <button className="btn btn--primary" onClick={onAddWord}>
            Add your first word
          </button>
        </div>
      </div>
    );
  }

  const caughtUp = dueCount === 0;
  const streakSuffix = streak > 1 ? ` · 🔥 ${streak}-day streak` : "";

  return (
    <div className="screen pad-top">
      <div className="screen__body gutter" style={{ paddingTop: 18, paddingBottom: 26, display: "flex", flexDirection: "column", gap: 20 }}>
        {caughtUp ? (
          // ── All caught up: calm cream card; practising ahead is optional (Figma 163:334) ──
          <section className="hero hero--calm">
            <div className="hero__content">
              <div className="hero__label hero__label--ink">Daily practice</div>
              <div className="hero__stat hero__stat--ink hero__stat--set">
                <CheckCircle size={26} className="hero__check" />
                You&rsquo;re all set!
              </div>
              <div className="hero__note hero__note--ink">
                {nextDueLabel ? `Your next review is ${nextDueLabel}.` : "Nothing scheduled."} You have{" "}
                {deckCount} word{deckCount === 1 ? "" : "s"} ready to go.{streakSuffix}
              </div>
            </div>
            <button className="btn btn--secondary" onClick={onPracticeAhead}>
              Prepare in advance
            </button>
          </section>
        ) : (
          <section className="hero">
            <div className="hero__content">
              <div className="hero__label">Daily practice</div>
              <div className="hero__stat">
                You have {dueCount} word{dueCount === 1 ? "" : "s"} ready to review in your deck.
              </div>
              {streakSuffix && <div className="hero__note">{streakSuffix.replace(" · ", "")}</div>}
            </div>
            <button className="hero__cta" onClick={onPractice}>
              Start practice
            </button>
          </section>
        )}

        <AddWordCard onAddWord={onAddWord} />
      </div>
    </div>
  );
}

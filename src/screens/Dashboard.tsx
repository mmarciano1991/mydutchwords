import { TulipMedallion, Wordmark } from "../components/brand";
import { PlusIcon } from "../components/icons";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Goedenacht";
  if (h < 12) return "Goedemorgen";
  if (h < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function Dashboard({
  deckCount,
  dueCount,
  nextDueLabel,
  onPractice,
  onPracticeAhead,
  onBrowse,
  onAddWord,
  streak,
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
  onBrowse: () => void;
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
            Pick the words you want to learn from the built-in dictionary, then
            practise them as flashcards.
          </p>
        </div>
        <div className="gutter" style={{ paddingBottom: 30 }}>
          <button className="btn btn--primary" onClick={onBrowse}>
            <PlusIcon color="#FBF8F1" /> Build your deck
          </button>
          <p className="faint" style={{ textAlign: "center", fontSize: 12.5, margin: "13px 0 0" }}>
            No account · works offline
          </p>
        </div>
      </div>
    );
  }

  const caughtUp = dueCount === 0;

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>{greeting()}</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        {caughtUp ? (
          // ── All caught up: calm success state; practicing ahead is optional ──
          <section className="hero">
            <div className="hero__content">
              <div className="hero__label">Daily practice</div>
              <div className="hero__stat">✓ All caught up</div>
              <div className="hero__note">
                {nextDueLabel ? `Next review ${nextDueLabel}.` : "Nothing scheduled."} {deckCount} word
                {deckCount === 1 ? "" : "s"} in your deck.
                {streak > 1 ? ` · 🔥 ${streak}-day streak` : ""}
              </div>
            </div>
            <button className="hero__cta hero__cta--ghost" onClick={onPracticeAhead}>
              Practice ahead
            </button>
          </section>
        ) : (
          <section className="hero">
            <div className="hero__content">
              <div className="hero__label">Daily practice</div>
              <div className="hero__stat">
                {dueCount} word{dueCount === 1 ? "" : "s"} due
              </div>
              <div className="hero__note">
                {deckCount} word{deckCount === 1 ? "" : "s"} in your deck
                {streak > 1 ? ` · 🔥 ${streak}-day streak` : ""}
              </div>
            </div>
            <button className="hero__cta" onClick={onPractice}>
              Start practice
            </button>
          </section>
        )}
      </div>

      <button className="fab" onClick={onAddWord} aria-label="Add a word">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path d="M13 5v16M5 13h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

import { TulipMedallion, Wordmark } from "../components/brand";
import { PlusIcon } from "../components/icons";
import type { DictionaryEntry } from "../lib/types";

const PRACTICE_MIN = 4;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Goedenacht";
  if (h < 12) return "Goedemorgen";
  if (h < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function Dashboard({
  deck,
  onPractice,
  onBrowse,
}: {
  deck: DictionaryEntry[];
  onPractice: () => void;
  onBrowse: () => void;
}) {
  const count = deck.length;
  const canPractice = count >= PRACTICE_MIN;

  // ── Empty deck: invite to build it ──
  if (count === 0) {
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

  const remaining = PRACTICE_MIN - count;

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>{greeting()}</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        <section className="hero">
          <div className="hero__content">
            <div className="hero__label">Daily practice</div>
            <div className="hero__stat">
              {count} word{count === 1 ? "" : "s"} in your deck
            </div>
          </div>

          {canPractice ? (
            <button className="hero__cta" onClick={onPractice}>
              Start practice
            </button>
          ) : (
            <div className="hero__locked">
              Add {remaining} more word{remaining === 1 ? "" : "s"} to start practising.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

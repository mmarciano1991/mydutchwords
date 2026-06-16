import type { Word } from "../lib/types";
import { HeroOrnament, TulipMedallion, Wordmark } from "../components/brand";
import { ArrowRight, PlusIcon } from "../components/icons";

const PRACTICE_THRESHOLD = 5;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Goedenacht";
  if (h < 12) return "Goedemorgen";
  if (h < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function Dashboard({
  words,
  onAdd,
  onPractice,
  onOpenWords,
}: {
  words: Word[];
  onAdd: () => void;
  onPractice: () => void;
  onOpenWords: () => void;
}) {
  const count = words.length;
  const canPractice = count >= PRACTICE_THRESHOLD;

  // ── First run: empty state ──
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
            Start by capturing one word you read today. We'll translate it and
            help you remember it.
          </p>
        </div>
        <div className="gutter" style={{ paddingBottom: 30 }}>
          <button className="btn btn--primary" onClick={onAdd}>
            <PlusIcon color="#FBF8F1" /> Capture your first word
          </button>
          <p className="faint" style={{ textAlign: "center", fontSize: 12.5, margin: "13px 0 0" }}>
            No account needed · Three taps to save
          </p>
        </div>
      </div>
    );
  }

  // ── Populated dashboard ──
  const recent = words.slice(0, 4);
  const remaining = PRACTICE_THRESHOLD - count;

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>{greeting()}</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        <section className="hero">
          <HeroOrnament />
          <div className="hero__label">Daily practice</div>
          <div className="hero__stat">
            {canPractice ? `${count} words ready` : `${count} word${count === 1 ? "" : "s"} saved`}
          </div>
          <div className="hero__sub">
            {canPractice
              ? "Tricky ones come up more often."
              : `${PRACTICE_THRESHOLD} words unlock practice`}
          </div>

          {canPractice ? (
            <button className="hero__cta" onClick={onPractice}>
              Start practice <ArrowRight />
            </button>
          ) : (
            <div className="hero__locked">
              Add {remaining} more word{remaining === 1 ? "" : "s"} to unlock practice.
            </div>
          )}
        </section>

        <div className="spread" style={{ alignItems: "baseline", margin: "24px 2px 13px" }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--text-display)" }}>
            Your words
          </span>
          <button className="link-btn faint" style={{ fontWeight: 400, fontSize: 12.5 }} onClick={onOpenWords}>
            See all
          </button>
        </div>

        <div className="wordlist">
          {recent.map((w) => (
            <div className="wordrow" key={w.id}>
              <span className="dot" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wordrow__dutch">{w.dutch}</div>
                <div className="wordrow__gloss">{w.translation}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="fab" onClick={onAdd} aria-label="Add a new word">
        <PlusIcon size={26} color="#fff" />
      </button>
    </div>
  );
}

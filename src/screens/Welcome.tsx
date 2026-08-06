/* Welcome — the first choice screen of the access flow (Figma 228:1789,
   "Fist screen"): medallion + wordmark + tagline, then Sign in / Log-in.
   Shown once, right after the splash, to any signed-out visitor; Auth's
   back chevron returns here. No guest/"try without an account" option —
   the app still requires a signed-in session (see App.tsx). */
import { TulipMedallion } from "../components/brand";

export function Welcome({
  onSignIn,
  onLogIn,
}: {
  /** Primary CTA — starts account creation. */
  onSignIn: () => void;
  /** Secondary CTA — starts sign-in for an existing account. */
  onLogIn: () => void;
}) {
  return (
    <div className="screen pad-top">
      <div className="screen__body center-col gutter" style={{ justifyContent: "center", flex: 1, paddingBottom: 24 }}>
        <div style={{ marginBottom: 26 }}>
          <TulipMedallion />
        </div>
        <div className="display--lg">Woordkast</div>
        <p
          className="title-serif"
          style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 22, maxWidth: 286, lineHeight: 1.3 }}
        >
          Capture the Dutch words you meet, then practise them as flashcards.
        </p>
      </div>
      <div className="gutter" style={{ paddingBottom: 30, display: "flex", flexDirection: "column", gap: 22 }}>
        <button className="btn btn--primary" onClick={onSignIn}>
          Sign in
        </button>
        <button className="btn btn--secondary" onClick={onLogIn}>
          Log-in
        </button>
      </div>
    </div>
  );
}

/* Auth — the simple account screen: email + password (sign in / create
   account), and "Continue with Google". Offline-first, so it's reachable
   from Settings but never forced. On success the session change (watched in
   App) navigates away; sign-up may instead ask the user to confirm by email. */
import { useState } from "react";
import { signInEmail, signInWithGoogle, signUpEmail } from "../lib/auth";
import { IconButton } from "../components/IconButton";
import { Notice } from "../components/Notice";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

type Mode = "signin" | "signup";

export function Auth({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const action = isSignup ? signUpEmail : signInEmail;
    const res = await action(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.needsConfirmation) setConfirmSent(true);
    // On a real sign-in the session change (watched in App) leaves this screen.
  }

  async function google() {
    setError(null);
    setBusy(true);
    const res = await signInWithGoogle();
    if (res.error) {
      setError(res.error);
      setBusy(false);
    }
    // On success the browser redirects to Google, so no further UI here.
  }

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <IconButton action="close" onClick={onBack} aria-label="Back" />
        <span className="title-serif" style={{ fontSize: 21 }}>
          {isSignup ? "Create account" : "Sign in"}
        </span>
      </div>

      <div className="screen__body gutter" style={{ paddingTop: 8, paddingBottom: 24 }}>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: "0 2px 18px" }}>
          {isSignup
            ? "Create a profile to save your deck and progress across devices."
            : "Sign in to sync your deck and progress across devices."}
        </p>

        {confirmSent ? (
          <Notice type="success">
            Almost there — check {email || "your inbox"} for a confirmation link, then sign in.
          </Notice>
        ) : (
          <>
            {error && (
              <div style={{ marginBottom: 14 }}>
                <Notice type="error">{error}</Notice>
              </div>
            )}

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="auth-field">
                <span className="auth-field__label">Email</span>
                <input
                  className="text-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  required
                />
              </label>
              <label className="auth-field">
                <span className="auth-field__label">Password</span>
                <input
                  className="text-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "At least 6 characters" : "Your password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={6}
                  required
                />
              </label>
              <button className="btn btn--primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
                {busy ? "One moment…" : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button className="btn btn--secondary" onClick={google} disabled={busy}>
              <GoogleGlyph />
              Continue with Google
            </button>

            <button
              className="link-btn"
              style={{ margin: "20px auto 0", display: "block" }}
              onClick={() => {
                setMode(isSignup ? "signin" : "signup");
                setError(null);
              }}
            >
              {isSignup ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

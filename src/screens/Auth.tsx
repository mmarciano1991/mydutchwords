/* Auth — the account screen: email + password (log in / create account),
   and "Continue with Google" (Figma 228:1789, "Sign-in" / "Log-in" frames).
   Every label here answers to the Welcome button that opened it: the
   create-account path says "Create account" throughout and the returning
   path says "Log in", so the screen never contradicts the door the user
   came through.
   The app is a hard gate behind this screen (App.tsx renders it in place of
   everything else while signed out); `onBack`, when given, returns to the
   Welcome choice screen rather than closing the gate. On success the
   session change (watched in App) navigates away; sign-up may instead ask
   the user to confirm by email. */
import { useState } from "react";
import {
  resendConfirmation,
  sendPasswordReset,
  signInEmail,
  signInWithGoogle,
  signUpEmail,
} from "../lib/auth";
import { Appbar } from "../components/Appbar";
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

type Mode = "signin" | "signup" | "reset";
/** Which email we're waiting on, if any — the screen becomes that step. */
type Sent = "confirm" | "reset";

export function Auth({
  initialMode = "signin",
  onBack,
}: {
  initialMode?: Exclude<Mode, "reset">;
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const address = email.trim();

    if (mode === "reset") {
      const res = await sendPasswordReset(address);
      setBusy(false);
      if (res.error) return setError(res.error);
      setSent("reset");
      return;
    }

    const action = isSignup ? signUpEmail : signInEmail;
    const res = await action(address, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.needsConfirmation) setSent("confirm");
    // On a real log-in the session change (watched in App) leaves this screen.
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

  async function resend() {
    setError(null);
    setBusy(true);
    const res = await resendConfirmation(email.trim());
    setBusy(false);
    if (res.error) return setError(res.error);
    setResent(true);
  }

  /** Every branch of this screen ends here rather than at a dead stop: the
   *  waiting-for-email steps and the reset form all offer the way back. */
  function backToLogin() {
    setMode("signin");
    setSent(null);
    setResent(false);
    setPassword("");
    setError(null);
  }

  // ── Waiting on an email ── its own step, with something to do while you
  // wait. Previously the confirmation replaced the form with a notice and no
  // action at all, mid-way through creating an account.
  if (sent) {
    return (
      <div className="screen">
        <Appbar title="Check your email" onBack={backToLogin} />
        <div className="screen__body gutter" style={{ paddingTop: 8, paddingBottom: 24 }}>
          <Notice type="success">
            {sent === "confirm"
              ? `We've sent a confirmation link to ${email || "your inbox"}. Open it, then come back here and log in.`
              : `We've sent a link to ${email || "your inbox"}. Open it to set a new password.`}
          </Notice>

          {error && (
            <div style={{ marginTop: 14 }}>
              <Notice type="error">{error}</Notice>
            </div>
          )}

          {sent === "confirm" && (
            <>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: "18px 2px" }}>
                Nothing after a minute or two? Check your spam folder, or send it again.
              </p>
              <button className="btn btn--secondary" onClick={resend} disabled={busy || resent}>
                {busy ? "One moment…" : resent ? "Sent again" : "Send it again"}
              </button>
            </>
          )}

          <button
            className="link-btn"
            style={{ margin: "22px auto 0", display: "block" }}
            onClick={backToLogin}
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  // ── Forgot your password ── email only; the new password is set back in
  // the app, after the link (see NewPassword).
  if (mode === "reset") {
    return (
      <div className="screen">
        <Appbar title="Reset your password" onBack={backToLogin} />
        <div className="screen__body gutter" style={{ paddingTop: 8, paddingBottom: 24 }}>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: "0 2px 18px" }}>
            Enter the email you signed up with and we&rsquo;ll send you a link to set a new
            password.
          </p>

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
            <button className="btn btn--primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? "One moment…" : "Send reset link"}
            </button>
          </form>

          <button
            className="link-btn"
            style={{ margin: "22px auto 0", display: "block" }}
            onClick={backToLogin}
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Appbar title={isSignup ? "Create an account" : "Log in"} onBack={onBack} />

      <div className="screen__body gutter" style={{ paddingTop: 8, paddingBottom: 24 }}>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: "0 2px 18px" }}>
          {isSignup
            ? "Create an account to save your deck and progress across devices."
            : "Log in to sync your deck and progress across devices."}
        </p>

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
            {busy ? "One moment…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        {!isSignup && (
          <button
            className="link-btn"
            style={{ margin: "14px auto 0", display: "block" }}
            onClick={() => {
              setMode("reset");
              setError(null);
            }}
          >
            Forgot your password?
          </button>
        )}

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
          {isSignup ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

/* Auth — the account screen: email + password (log in / create account),
   and "Continue with Apple" / "Continue with Google" (Figma 228:1789,
   "Sign-in" / "Log-in" frames; Apple added for App Review guideline 4.8).
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
  oauthProviders,
  signInWithProvider,
  signUpEmail,
  verifyRecoveryOtp,
  verifySignupOtp,
  type OAuthProvider,
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

/** Apple's mark, drawn in the button's own text colour (Apple's sign-in
 *  button guidelines: black button, white logo and label). */
function AppleGlyph() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788 341c-6 4-108 62-108 190 0 149 131 201 135 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C45 792 0 668 0 550c0-190 124-291 246-291 65 0 119 43 160 43 39 0 100-45 174-45 28 0 129 3 196 84zM558 168c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 33-146 75-28 32-55 83-55 135 0 8 1 15 2 18 3 1 9 2 14 2 45 0 102-30 134-71z" />
    </svg>
  );
}

const PROVIDER_LABEL: Record<OAuthProvider, string> = { apple: "Continue with Apple", google: "Continue with Google" };

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
  const [code, setCode] = useState("");

  const isSignup = mode === "signup";
  const providers = oauthProviders();

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

  async function social(provider: OAuthProvider) {
    setError(null);
    setBusy(true);
    const res = await signInWithProvider(provider);
    if (res.error) {
      setError(res.error);
      setBusy(false);
    }
    // On success the browser redirects to the provider (or, in a native
    // shell, the system sheet opens), so no further UI here.
  }

  async function resend() {
    setError(null);
    setBusy(true);
    const res = await resendConfirmation(email.trim());
    setBusy(false);
    if (res.error) return setError(res.error);
    setResent(true);
  }

  /** Verifying signs the user in directly (verifyOtp returns a session) —
   *  no separate "now log in" step, unlike the link, which only confirms
   *  the account and still requires a password afterward. A recovery code
   *  signs in with a recovery session, which App turns into "Set a new
   *  password". */
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setError(null);
    setBusy(true);
    const verify = sent === "reset" ? verifyRecoveryOtp : verifySignupOtp;
    const res = await verify(email.trim(), code.trim());
    setBusy(false);
    if (res.error) return setError(res.error);
    // On success the session change (watched in App) leaves this screen.
  }

  /** Every branch of this screen ends here rather than at a dead stop: the
   *  waiting-for-email steps and the reset form all offer the way back. */
  function backToLogin() {
    setMode("signin");
    setSent(null);
    setResent(false);
    setPassword("");
    setCode("");
    setError(null);
  }

  // ── Waiting on an email ── its own step, with something to do while you
  // wait. Previously the confirmation replaced the form with a notice and no
  // action at all, mid-way through creating an account.
  if (sent) {
    return (
      <div className="screen">
        <Appbar title="Check your email" onBack={backToLogin} />
        <div className="screen__body gutter auth-body">
          <Notice type="success">
            {sent === "confirm"
              ? `We've sent a code to ${email || "your inbox"}. Enter it below to finish creating your account.`
              : `We've sent a code to ${email || "your inbox"}. Enter it below, then choose a new password.`}
          </Notice>

          {error && (
            <div className="auth-error auth-error--after">
              <Notice type="error">{error}</Notice>
            </div>
          )}

          <form className="auth-form auth-form--after" onSubmit={verifyCode}>
            <label className="auth-field">
              <span className="auth-field__label">{sent === "confirm" ? "Confirmation code" : "Reset code"}</span>
              <input
                className="text-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
              />
            </label>
            <button className="btn btn--primary" type="submit" disabled={busy || !code.trim()}>
              {busy ? "One moment…" : "Verify and continue"}
            </button>
          </form>

          {sent === "confirm" && (
            <>
              <p className="muted auth-intro auth-intro--after">
                Got a link instead of a code? Opening it confirms your account the same way — come back
                here and log in afterward. Nothing after a minute or two? Check your spam folder, or send
                it again.
              </p>
              <button className="btn btn--secondary" onClick={resend} disabled={busy || resent}>
                {busy ? "One moment…" : resent ? "Sent again" : "Send it again"}
              </button>
            </>
          )}
          {sent === "reset" && (
            <p className="muted auth-intro auth-intro--after">
              Nothing after a minute or two? Check your spam folder, or go back and send it again.
            </p>
          )}

          <button
            className="link-btn link-btn--center"
            onClick={backToLogin}
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  // ── Forgot your password ── email only; the code from the email is typed
  // in next, and the new password set after it (see NewPassword).
  if (mode === "reset") {
    return (
      <div className="screen">
        <Appbar title="Reset your password" onBack={backToLogin} />
        <div className="screen__body gutter auth-body">
          <p className="muted auth-intro">
            Enter the email you signed up with and we&rsquo;ll send you a code to set a new
            password.
          </p>

          {error && (
            <div className="auth-error">
              <Notice type="error">{error}</Notice>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
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
            <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
              {busy ? "One moment…" : "Send reset code"}
            </button>
          </form>

          <button
            className="link-btn link-btn--center"
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

      <div className="screen__body gutter auth-body">
        <p className="muted auth-intro">
          {isSignup
            ? "Create an account to save your deck and progress across devices."
            : "Log in to sync your deck and progress across devices."}
        </p>

        {error && (
          <div className="auth-error">
            <Notice type="error">{error}</Notice>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
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
          <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
            {busy ? "One moment…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        {!isSignup && (
          <button
            className="link-btn link-btn--center auth-forgot"
            onClick={() => {
              setMode("reset");
              setError(null);
            }}
          >
            Forgot your password?
          </button>
        )}

        {providers.length > 0 && (
          <div className="auth-divider">
            <span>or</span>
          </div>
        )}

        {providers.map((p) => (
          <button
            key={p}
            className={p === "apple" ? "btn btn--apple" : "btn btn--secondary"}
            onClick={() => void social(p)}
            disabled={busy}
          >
            {p === "apple" ? <AppleGlyph /> : <GoogleGlyph />}
            {PROVIDER_LABEL[p]}
          </button>
        ))}

        <button
          className="link-btn link-btn--center auth-switch"
          onClick={() => {
            setMode(isSignup ? "signin" : "signup");
            setError(null);
          }}
        >
          {isSignup ? "Already have an account? Log in" : "New here? Create an account"}
        </button>

        <p className="faint auth-legal">
          {isSignup ? "By creating an account you accept how we handle your data, as set out in our " : "Read our "}
          <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener">
            privacy policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

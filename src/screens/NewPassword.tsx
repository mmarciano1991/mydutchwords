/* NewPassword — the second half of password recovery. Following a recovery
   link signs the user in, so without this screen they'd land on the dashboard
   with the password they came to change still unchanged, and no way to change
   it. App renders this ahead of everything else while that recovery is live.

   "Not now" is offered because the session is already valid: someone who
   opened the link by accident, or who has remembered the password meanwhile,
   shouldn't be held on a screen they don't need. */
import { useState } from "react";
import { updatePassword } from "../lib/auth";
import { Appbar } from "../components/Appbar";
import { Notice } from "../components/Notice";

export function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <div className="screen">
      <Appbar title="Set a new password" />

      <div className="screen__body gutter auth-body">
        <p className="muted auth-intro">
          You&rsquo;re logged in from the link in your email. Choose a new password and
          you&rsquo;ll be able to log in with it from now on.
        </p>

        {error && (
          <div className="auth-error">
            <Notice type="error">{error}</Notice>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            <span className="auth-field__label">New password</span>
            <input
              className="text-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              minLength={6}
              autoFocus
              required
            />
          </label>
          <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
            {busy ? "One moment…" : "Save password"}
          </button>
        </form>

        <button
          className="link-btn link-btn--center"
          onClick={onDone}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

/* Auth actions — thin wrappers over Supabase auth for the capture-simple
   account flow: email + password, and Apple / Google OAuth. Each returns a
   plain { error } (string | null) so screens can render a message without
   importing Supabase types. No-ops with a friendly error when unconfigured.

   Nothing here depends on an email link coming back to the app: sign-up and
   password reset both finish by typing a 6-digit code (see
   docs/auth-setup.md for the two email templates), which works the same in
   a browser tab and in a native shell. OAuth is the one flow that leaves
   the app; inside a native shell it opens the system sign-in sheet and
   returns through the shell's URL scheme (lib/platform). */
import { supabase } from "./supabase";
import { authRedirectUrl, capacitor } from "./platform";

export type OAuthProvider = "apple" | "google";

/** The social sign-in buttons this build offers, in order — Apple first, as
 *  App Review expects it at least as prominent as any other provider. */
export function oauthProviders(): OAuthProvider[] {
  // An unset CI variable arrives as "", which means the default too.
  const raw = import.meta.env.VITE_OAUTH_PROVIDERS?.trim() || "apple,google";
  const wanted = raw.split(",").map((p) => p.trim().toLowerCase());
  return (["apple", "google"] as const).filter((p) => wanted.includes(p));
}

export interface AuthResult {
  error: string | null;
  /** Sign-up only: true when Supabase sent a confirmation email (no session yet). */
  needsConfirmation?: boolean;
}

const NOT_CONFIGURED = "Cloud sync isn’t set up yet.";

export async function signInEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signUpEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  // An address that already has an account gets a stand-in user with no
  // identities and no error (so sign-up can't be used to probe addresses),
  // and no email is sent — saying "we've sent a code" would leave the user
  // waiting for nothing.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "There’s already an account with this email. Log in instead — or reset your password." };
  }
  // With email confirmation on, a user is created but there's no session yet.
  const needsConfirmation = Boolean(data.user && !data.session);
  return { error: null, needsConfirmation };
}

/** Sends the sign-up confirmation email again — for the one that never
 *  arrived, or was lost in a spam folder before the user came back. */
export async function resendConfirmation(email: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.resend({ type: "signup", email });
  return { error: error?.message ?? null };
}

/** Verifies the code from a sign-up confirmation email and signs the user
 *  in directly — no separate "now log in" step, since verifyOtp already
 *  returns a session. Requires the project's confirmation email template to
 *  contain {{ .Token }} (a one-time dashboard change — see
 *  docs/auth-setup.md); this call works either way, but only reads as a
 *  6-digit code to the user once that template change is made, otherwise
 *  the email still shows a link and this field goes unused. */
export async function verifySignupOtp(email: string, token: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  return { error: error?.message ?? null };
}

/** Emails a recovery code (and, until the template is changed, a link).
 *  The code is typed back in with verifyRecoveryOtp, so the loop never
 *  depends on a link opening the app. */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl(),
  });
  return { error: error?.message ?? null };
}

/** Verifies the recovery code. It signs the user in with a recovery session
 *  (Supabase emits PASSWORD_RECOVERY), which App turns into the "Set a new
 *  password" screen. */
export async function verifyRecoveryOtp(email: string, token: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
  return { error: error?.message ?? null };
}

/** Sets a new password for the currently-signed-in (or recovering) user. */
export async function updatePassword(password: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}

export async function signInWithProvider(provider: OAuthProvider): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const browser = capacitor()?.Plugins?.Browser;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectUrl(),
      // In a native shell the page must not navigate itself: Google refuses
      // sign-in inside an embedded web view, so the URL opens in the system
      // sheet instead and comes back through handleAuthCallback.
      skipBrowserRedirect: Boolean(browser),
    },
  });
  if (error) return { error: error.message };
  if (browser && data.url) await browser.open({ url: data.url, presentationStyle: "popover" });
  return { error: null };
}

/** Finishes an OAuth sign-in that came back through a native shell's URL
 *  scheme ("woordkast://auth-callback?code=…"). Resolves true when it
 *  signed the user in. In a browser, supabase-js does this itself
 *  (detectSessionInUrl). */
export async function handleAuthCallback(url: string): Promise<boolean> {
  if (!supabase) return false;
  let code: string | null = null;
  try {
    code = new URL(url).searchParams.get("code");
  } catch {
    return false;
  }
  if (!code) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  void capacitor()?.Plugins?.Browser?.close?.();
  if (error) console.warn("[woordkast] sign-in callback failed", error.message);
  return !error;
}

let callbackListening = false;

/** In a native shell, listens for the auth callback once per launch —
 *  including the launch the callback itself caused. A no-op in a browser. */
export function listenForAuthCallbacks(): void {
  const app = capacitor()?.Plugins?.App;
  if (!app || callbackListening) return;
  callbackListening = true;
  void app.addListener("appUrlOpen", ({ url }) => void handleAuthCallback(url));
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Deletes the signed-in account and everything stored for it on the server
 *  (delete_my_account, see 20261017130000_account_deletion_and_consent.sql),
 *  then ends the session on this device. Clearing this device's copy is the
 *  caller's job, as with signing out. */
export async function deleteAccount(): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: error.message };
  // The user no longer exists, so only the local session can be ended.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return { error: null };
}

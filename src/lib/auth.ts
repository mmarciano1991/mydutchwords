/* Auth actions — thin wrappers over Supabase auth for the capture-simple
   account flow: email + password, and Google (Gmail) OAuth. Each returns a
   plain { error } (string | null) so screens can render a message without
   importing Supabase types. No-ops with a friendly error when unconfigured. */
import { supabase } from "./supabase";

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

/** Emails a recovery link. Following it returns to the app with a recovery
 *  session, which App turns into the "Set a new password" screen — so the
 *  loop finishes in the app rather than leaving the user signed in with the
 *  password they couldn't remember. */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  return { error: error?.message ?? null };
}

/** Sets a new password for the currently-signed-in (or recovering) user. */
export async function updatePassword(password: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Return to wherever the app is served from (Hostinger domain in prod).
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

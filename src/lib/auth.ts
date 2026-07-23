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

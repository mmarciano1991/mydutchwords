/* useAuth — current Supabase session as React state. When cloud sync isn't
   configured it reports { ready: true, user: null } immediately, so callers
   can treat "logged out" and "no backend" the same way. */
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

export interface AuthState {
  session: Session | null;
  user: Session["user"] | null;
  /** False until the initial session lookup resolves (only relevant when configured). */
  ready: boolean;
  configured: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // Initial read is from local storage (fast, offline-safe); refresh is background.
    supabase.auth
      .getSession()
      .then(({ data }) => active && setSession(data.session))
      .catch(() => {})
      .finally(() => active && setReady(true));

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, ready, configured: isSupabaseConfigured };
}

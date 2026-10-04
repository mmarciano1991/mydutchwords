/* useAuth — current Supabase session as React state. When cloud sync isn't
   configured it reports { ready: true, user: null } immediately, so callers
   can treat "logged out" and "no backend" the same way.

   It also surfaces the one session that isn't an ordinary login: arriving on
   a password-recovery link signs the user in, which would otherwise drop them
   into the app with the password they came to change still unchanged. */
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

export interface AuthState {
  session: Session | null;
  user: Session["user"] | null;
  /** False until the initial session lookup resolves (only relevant when configured). */
  ready: boolean;
  configured: boolean;
  /** True from following a recovery link until the password is set or dismissed. */
  recovering: boolean;
  clearRecovery: () => void;
}

/* The recovery link's session is an ordinary one once it's stored, so a
   reload mid-recovery would land in the app with the old password still set.
   The fact that a recovery is under way is kept for the tab's lifetime. */
const RECOVERY_KEY = "woordkast.recovering";

function readRecovering(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRecovering(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, "1");
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Private mode: recovery then lasts until a reload, as before.
  }
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [recovering, setRecovering] = useState(readRecovering);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // Initial read is from local storage (fast, offline-safe); refresh is background.
    supabase.auth
      .getSession()
      .then(({ data }) => active && setSession(data.session))
      .catch((err) => console.warn("[woordkast] could not read the saved session", err))
      .finally(() => active && setReady(true));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        writeRecovering(true);
        setRecovering(true);
      }
      // Signed out (or the session lapsed): nothing is being recovered.
      if (!next) {
        writeRecovering(false);
        setRecovering(false);
      }
      setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const clearRecovery = useCallback(() => {
    writeRecovering(false);
    setRecovering(false);
  }, []);

  return {
    session,
    user: session?.user ?? null,
    ready,
    configured: isSupabaseConfigured,
    recovering,
    clearRecovery,
  };
}

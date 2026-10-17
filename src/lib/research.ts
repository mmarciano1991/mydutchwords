/* research — the learner's consent to the field study.

   The review log (lib/reviewEvents) records every answer with its response
   time, for research. It is opt-in: nothing is recorded or uploaded until
   the learner turns "Help research" on in Settings, and turning it off
   drops what is still waiting to upload. The flag lives in the account's
   user_metadata, so it follows the learner across devices and the server
   can enforce it (review_events refuses rows without it — see
   supabase/migrations/20261017130000_account_deletion_and_consent.sql). */
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function hasResearchConsent(user: Pick<User, "user_metadata"> | null | undefined): boolean {
  return user?.user_metadata?.research_consent === true;
}

/** Gives or withdraws consent. Resolves an error message, or null. */
export async function setResearchConsent(on: boolean): Promise<string | null> {
  if (!supabase) return "Cloud sync isn’t set up yet.";
  const { error } = await supabase.auth.updateUser({
    data: { research_consent: on, research_consent_at: new Date().toISOString() },
  });
  if (error) return error.message;
  // The server reads the flag from the access token, which only carries the
  // new value once refreshed.
  await supabase.auth.refreshSession().catch(() => undefined);
  return null;
}

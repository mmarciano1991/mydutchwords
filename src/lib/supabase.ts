/* Supabase client — optional cloud sync (accounts + saved progress).
   Reads its config from Vite env vars (VITE_SUPABASE_URL / _ANON_KEY). When
   either is missing the client is null and `isSupabaseConfigured` is false —
   the app then runs fully offline, exactly as before, and all account UI
   stays hidden. This keeps the build shippable before a project is set up. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
// Accept either the classic anon key or Supabase's newer publishable key
// (sb_publishable_…) — both are browser-safe public keys.
const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const isSupabaseConfigured = Boolean(url && publicKey);

/** An Edge Function's URL and the headers to call it with, or null when no
 *  project is configured. For functions that answer with something other
 *  than JSON (audio), which `functions.invoke` would read as text. */
export function edgeFunction(name: string): { url: string; headers: Record<string, string> } | null {
  if (!isSupabaseConfigured) return null;
  return {
    url: `${url!.replace(/\/$/, "")}/functions/v1/${name}`,
    headers: { apikey: publicKey!, Authorization: `Bearer ${publicKey}`, "Content-Type": "application/json" },
  };
}

/** The shared client, or null when no project is configured. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publicKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // OAuth (Google) returns to the app with tokens in the URL; pick them up.
        detectSessionInUrl: true,
      },
    })
  : null;

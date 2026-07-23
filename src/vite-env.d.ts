/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (optional — enables cloud sync when set). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key, "sb_publishable_…" (current dashboard naming). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Older name for the same public key ("anon key") — either works. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (optional — enables cloud sync when set). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/public key (optional — safe to expose in the frontend). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (optional — enables cloud sync when set). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key, "sb_publishable_…" (current dashboard naming). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Older name for the same public key ("anon key") — either works. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Where OAuth and email links return to. Unset on the web (the page's
   *  own URL); a native shell sets its scheme, e.g. woordkast://auth-callback. */
  readonly VITE_AUTH_REDIRECT_URL?: string;
  /** Social sign-in buttons, comma-separated: "apple,google" by default.
   *  Each must be enabled under Supabase → Authentication → Providers. */
  readonly VITE_OAUTH_PROVIDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** package.json "version", baked in at build time (vite.config.ts). */
declare const __APP_VERSION__: string;

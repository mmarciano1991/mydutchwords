/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the proxy endpoint (defaults to "api.php" relative to the app). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

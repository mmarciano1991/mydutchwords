/* platform — the one place that knows whether the app runs in a browser or
   inside a native shell (Capacitor, planned for iOS and Android).

   Nothing here imports Capacitor: a native build injects `window.Capacitor`
   and its plugins at runtime, and the web build never has it. Each native
   path is therefore guarded and falls back to the web behaviour, so the web
   app is unchanged until a shell exists.

   What the native shell must provide, when it is added:
     - a URL scheme or universal link for auth (VITE_AUTH_REDIRECT_URL,
       e.g. "woordkast://auth-callback"), added to Supabase's redirect URLs
     - @capacitor/app        (appUrlOpen: the auth callback coming back)
     - @capacitor/browser    (OAuth in the system sheet: Google refuses
                              sign-in inside an embedded web view)
     - @capacitor/local-notifications  (the daily reminder, lib/reminders)
     - @capacitor/preferences          (a durable copy of progress,
                                        lib/durableStore) */

interface PluginListener {
  remove: () => Promise<void> | void;
}

/** The slice of the Capacitor runtime this app uses. */
export interface CapacitorRuntime {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    App?: {
      addListener: (event: "appUrlOpen", cb: (e: { url: string }) => void) => Promise<PluginListener> | PluginListener;
    };
    Browser?: { open: (opts: { url: string; presentationStyle?: string }) => Promise<void>; close?: () => Promise<void> };
    LocalNotifications?: LocalNotificationsPlugin;
    Preferences?: {
      get: (opts: { key: string }) => Promise<{ value: string | null }>;
      set: (opts: { key: string; value: string }) => Promise<void>;
      remove: (opts: { key: string }) => Promise<void>;
      keys: () => Promise<{ keys: string[] }>;
    };
  };
}

export interface LocalNotificationsPlugin {
  checkPermissions: () => Promise<{ display: string }>;
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (opts: {
    notifications: {
      id: number;
      title: string;
      body: string;
      schedule?: { at?: Date; allowWhileIdle?: boolean };
    }[];
  }) => Promise<unknown>;
  cancel: (opts: { notifications: { id: number }[] }) => Promise<void>;
}

/** The native runtime, or null in a plain browser. */
export function capacitor(): CapacitorRuntime | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorRuntime }).Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

export function isNative(): boolean {
  return capacitor() !== null;
}

/** Where Supabase sends the user back to after OAuth or an email link: the
 *  configured URL (a native shell's scheme), else wherever the web app is
 *  served from. */
export function authRedirectUrl(): string {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (configured) return configured;
  return window.location.origin + window.location.pathname;
}

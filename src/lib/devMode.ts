/* Admin and dev mode.

   An admin is a Supabase user whose app_metadata carries "role": "admin".
   app_metadata can only be written with the service role (the dashboard or
   SQL), never by the user from the client, so the flag can't be granted
   from inside the app. It only unlocks developer tools in Settings; it
   grants no access to anyone else's data (row-level security is unchanged).

   Dev mode itself is a per-device switch an admin turns on in Settings. */
import type { User } from "@supabase/supabase-js";

export function isAdmin(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.role === "admin";
}

const DEV_MODE_KEY = "woordkast.devMode";

export function readDevMode(): boolean {
  try {
    return localStorage.getItem(DEV_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDevMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEV_MODE_KEY, "1");
    else localStorage.removeItem(DEV_MODE_KEY);
  } catch {
    // Private mode: the switch then lasts until a reload.
  }
}

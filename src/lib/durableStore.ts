/* durableStore — keeps the learner's progress from living only in
   localStorage, which a browser (or iOS, for an app's web view) may clear.

   Three layers, each a fallback for the one before:
     1. persistent storage — the browser is asked not to evict this site's
        data under storage pressure (navigator.storage.persist);
     2. in a native shell, a mirror in the OS's own key-value store
        (Capacitor Preferences): written when the app is backgrounded and
        every half minute, and copied back into localStorage at launch for
        any key that went missing;
     3. a backup file the learner can save and load again (Settings).

   Only the learner's own data is covered — the deck, its words, results,
   the practice run and the habit — not device switches or the sync owner. */
import { capacitor } from "./platform";

/** The keys that hold the learner's progress (lib/storage, lib/wordSources). */
export const PROGRESS_KEYS = [
  "woordkast.deck",
  "woordkast.customWords",
  "woordkast.results",
  "woordkast.practiceRun",
  "woordkast.habit",
] as const;

const MIRROR_PREFIX = "mirror:";
const MIRROR_EVERY_MS = 30_000;

// ── 1. Persistent storage ──

/** Asks the browser to keep this site's storage. Resolves whether it will.
 *  Browsers decide by their own rules (installed, engaged…); asking is free
 *  and shows no prompt in Chrome or Safari. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ── 2. Native mirror ──

function preferences() {
  return capacitor()?.Plugins?.Preferences ?? null;
}

/** Copies back any progress key localStorage lost. Run before the app reads
 *  its state; a no-op in a browser. */
export async function restoreFromMirror(): Promise<number> {
  const prefs = preferences();
  if (!prefs) return 0;
  let restored = 0;
  for (const key of PROGRESS_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) continue;
      const { value } = await prefs.get({ key: MIRROR_PREFIX + key });
      if (value !== null) {
        localStorage.setItem(key, value);
        restored++;
      }
    } catch (err) {
      console.warn(`[woordkast] could not restore "${key}"`, err);
    }
  }
  return restored;
}

/** Writes the progress keys to the native mirror. */
export async function writeMirror(): Promise<void> {
  const prefs = preferences();
  if (!prefs) return;
  for (const key of PROGRESS_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) await prefs.remove({ key: MIRROR_PREFIX + key });
      else await prefs.set({ key: MIRROR_PREFIX + key, value });
    } catch (err) {
      console.warn(`[woordkast] could not mirror "${key}"`, err);
    }
  }
}

let mirroring = false;

/** Keeps the native mirror current while the app runs. A no-op in a browser. */
export function startMirroring(): void {
  if (mirroring || !preferences()) return;
  mirroring = true;
  const write = () => void writeMirror();
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && write());
  window.addEventListener("pagehide", write);
  window.setInterval(write, MIRROR_EVERY_MS);
}

/** Before the app reads its state: restore what was lost, then keep the
 *  copies current. Never rejects. */
export async function prepareDurableStorage(): Promise<void> {
  void requestPersistentStorage();
  await restoreFromMirror().catch(() => 0);
  startMirroring();
}

// ── 3. Backup file ──

export interface Backup {
  app: "woordkast";
  version: 1;
  exportedAt: string;
  data: Partial<Record<(typeof PROGRESS_KEYS)[number], unknown>>;
}

/** This device's progress, as a backup. */
export function createBackup(now = new Date()): Backup {
  const data: Backup["data"] = {};
  for (const key of PROGRESS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch {
      // An unreadable key is left out rather than failing the backup.
    }
  }
  return { app: "woordkast", version: 1, exportedAt: now.toISOString(), data };
}

/** The backup in `text`, or an error message saying why it can't be used. */
export function parseBackup(text: string): Backup | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "This file isn’t a Woordkast backup.";
  }
  const b = parsed as Partial<Backup> | null;
  if (!b || b.app !== "woordkast" || typeof b.data !== "object" || b.data === null) {
    return "This file isn’t a Woordkast backup.";
  }
  if (b.version !== 1) return "This backup was made by a newer version of Woordkast.";
  if (b.data["woordkast.deck"] !== undefined && !Array.isArray(b.data["woordkast.deck"])) {
    return "This backup is damaged: its deck can’t be read.";
  }
  if (b.data["woordkast.results"] !== undefined && !Array.isArray(b.data["woordkast.results"])) {
    return "This backup is damaged: its results can’t be read.";
  }
  return b as Backup;
}

/** Replaces this device's progress with the backup's. The app must reload
 *  afterwards to read it; with an account, sync then merges it in. */
export function restoreBackup(backup: Backup): void {
  for (const key of PROGRESS_KEYS) {
    const value = backup.data[key];
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
}

/** A file name for the backup: woordkast-backup-2026-10-17.json */
export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `woordkast-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

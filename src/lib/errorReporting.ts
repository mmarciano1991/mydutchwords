/* errorReporting — crash reports, so a production failure isn't invisible.

   Catches render errors (ErrorBoundary), uncaught errors and unhandled
   promise rejections, and adds each to the insert-only `error_reports`
   table (supabase/migrations/20261017140000_error_reports.sql). A report
   holds the error, the screen path and the build — never a user id, email
   or deck, and email addresses in messages are masked. Without a Supabase
   project it only logs to the console, as before.

   Bounded so a loop can't flood anything: the same error is sent once per
   launch, and at most MAX_PER_LAUNCH reports in all. */
import { capacitor } from "./platform";

/* Loaded on first report, not at boot: this module runs before the app
   chunk, and the Supabase client belongs in that chunk. */
const hasProject = Boolean(import.meta.env.VITE_SUPABASE_URL?.trim());

export type ErrorSource = "render" | "error" | "rejection";

export const MAX_PER_LAUNCH = 5;

const sent = new Set<string>();
let count = 0;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/** Masks email addresses, and cuts to `max` characters. */
export function scrub(text: string, max: number): string {
  return text.replace(EMAIL, "[email]").slice(0, max);
}

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack ?? null };
  if (typeof error === "string") return { message: error, stack: null };
  try {
    return { message: JSON.stringify(error) ?? String(error), stack: null };
  } catch {
    return { message: String(error), stack: null };
  }
}

/** The report as it is stored, or null when it shouldn't be sent (already
 *  sent this launch, or over the launch's budget). Exported for tests. */
export function buildReport(error: unknown, source: ErrorSource, extraStack?: string) {
  const { message, stack } = describe(error);
  const key = `${source}|${message}`;
  if (sent.has(key) || count >= MAX_PER_LAUNCH) return null;
  sent.add(key);
  count++;
  const fullStack = [stack, extraStack].filter(Boolean).join("\n--\n");
  return {
    message: scrub(message || "(no message)", 500),
    stack: fullStack ? scrub(fullStack, 4000) : null,
    source,
    // The path only: a query string or fragment can hold an auth code.
    path: typeof window === "undefined" ? null : window.location.pathname.slice(0, 200),
    release: __APP_VERSION__.slice(0, 40),
    platform: (capacitor()?.getPlatform?.() ?? "web").slice(0, 20),
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 300),
  };
}

/** Reports one error. Never throws. */
export function reportError(error: unknown, source: ErrorSource, extraStack?: string): void {
  console.error("[woordkast]", source, error);
  if (!hasProject || import.meta.env.MODE === "test") return;
  const report = buildReport(error, source, extraStack);
  if (!report) return;
  void import("./supabase")
    .then(async ({ supabase }) => {
      if (!supabase) return;
      const { error: failed } = await supabase.from("error_reports").insert(report);
      if (failed) console.warn("[woordkast] error report not sent", failed.message);
    })
    .catch(() => undefined);
}

/** Resets the per-launch bookkeeping (tests). */
export function resetErrorReporting(): void {
  sent.clear();
  count = 0;
}

let installed = false;

/** Listens for uncaught errors and rejections, once. */
export function installErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, "error"));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "rejection"));
}

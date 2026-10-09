/* reviewEvents — the append-only review log, the audit trail for the field
   study. One row per exercise answered: graded or not, exposure and skips
   included.

   Word state (the deck) is the operational source of truth; this log is
   never read back to change it, only to analyse and debug it. Rows are
   never edited or deleted.

   Offline-first, like the rest of the app: each event goes into a local
   outbox the moment it happens, and the outbox is flushed to the
   `review_events` table whenever the user is signed in. Ids are generated
   on the device, and the insert ignores ids already present, so a flush
   that is retried after a network failure never duplicates a row.

   Every event is stamped with the signed-in user at the time it happened,
   and only that user's events are ever uploaded — so a device that changes
   accounts can't attribute one person's answers to another. */
import type { ReviewEventDraft } from "./learningEngine";
import { supabase } from "./supabase";

const OUTBOX_KEY = "woordkast.reviewEvents.outbox";
const TABLE = "review_events";
/** Rows per insert request. */
const BATCH = 200;

export interface ReviewEvent extends ReviewEventDraft {
  id: string;
  /** Who answered — null when nobody was signed in. */
  userId: string | null;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // RFC 4122 v4 from Math.random — only for environments without crypto.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** A new id for a session — shared by every event in it. */
export function newSessionId(): string {
  return newId();
}

function readOutbox(): ReviewEvent[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[woordkast] could not read the review log outbox", err);
    return [];
  }
}

function writeOutbox(events: ReviewEvent[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn("[woordkast] could not save the review log outbox", err);
  }
}

/** Appends one event to the local outbox. */
export function appendReviewEvent(draft: ReviewEventDraft, userId: string | null): ReviewEvent {
  const event: ReviewEvent = { ...draft, id: newId(), userId };
  writeOutbox([...readOutbox(), event]);
  return event;
}

/** Events not yet uploaded. */
export function pendingReviewEvents(): ReviewEvent[] {
  return readOutbox();
}

function toRow(e: ReviewEvent) {
  return {
    id: e.id,
    user_id: e.userId,
    word_id: e.wordId,
    session_id: e.sessionId,
    occurred_at: e.timestamp,
    local_date: e.localDate,
    exercise_type: e.exerciseType,
    result: e.result,
    graded: e.graded,
    response_time_ms: e.responseTimeMs === null ? null : Math.round(e.responseTimeMs),
    state_before: e.stateBefore,
    state_after: e.stateAfter,
    interval_before: e.intervalBefore,
    interval_after: e.intervalAfter,
  };
}

let flushing: Promise<boolean> | null = null;

/** Uploads this user's pending events. Resolves true when nothing of
 *  theirs is left pending. Never throws; concurrent calls share one flush. */
export function flushReviewEvents(userId: string): Promise<boolean> {
  if (!supabase) return Promise.resolve(false);
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const mine = readOutbox().filter((e) => e.userId === userId);
      const sent = new Set<string>();
      for (let i = 0; i < mine.length; i += BATCH) {
        const batch = mine.slice(i, i + BATCH);
        const { error } = await supabase!
          .from(TABLE)
          .upsert(batch.map(toRow), { onConflict: "id", ignoreDuplicates: true });
        if (error) break;
        batch.forEach((e) => sent.add(e.id));
      }
      // Re-read: events appended while the request was in flight stay.
      if (sent.size > 0) writeOutbox(readOutbox().filter((e) => !sent.has(e.id)));
      return sent.size === mine.length;
    } catch {
      return false;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

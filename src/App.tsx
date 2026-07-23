import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./lib/types";
import { addCustomEntry, resolveEntry } from "./lib/wordSources";
import { isInDeck, loadDeck, loadResults, newDeckItem, saveDeck, saveResults } from "./lib/storage";
import {
  buildNextSession,
  buildRestudySession,
  buildSession,
  buildSessionReport,
  isLeech,
  markAsKnown,
  SESSION_CAP,
  type ReviewedCard,
  type SessionReport as EngineSessionReport,
  type Word,
} from "./lib/learningEngine";
import { streakDays } from "./lib/streak";
import { useAuth } from "./lib/useAuth";
import { useCloudSync } from "./lib/useCloudSync";
import { setCustomEntries } from "./lib/wordSources";
import { signOut } from "./lib/auth";
import type { AppState } from "./lib/cloudState";
import { Dashboard } from "./screens/Dashboard";
import { Browse } from "./screens/Browse";
import { Practice, type PracticeCard } from "./screens/Practice";
import { SessionReport } from "./screens/SessionReport";
import { Capture } from "./screens/Capture";
import { Settings } from "./screens/Settings";
import { Auth } from "./screens/Auth";
import { TabBar, type Tab } from "./components/TabBar";

type Route = Tab | "practice" | "report" | "capture" | "auth";

const FOCUSED: Route[] = ["practice", "report", "capture", "auth"];

/** Joins spaced-repetition Words back to their dictionary content for display. */
function toPracticeCards(words: Word[]): PracticeCard[] {
  return words
    .map((word) => {
      const entry = resolveEntry(word.id);
      return entry ? { entry, word } : null;
    })
    .filter((c): c is PracticeCard => c !== null);
}

export default function App() {
  const [deck, setDeck] = useState<DeckItem[]>(() => loadDeck());
  const [results, setResults] = useState<PracticeResult[]>(() => loadResults());
  const [route, setRoute] = useState<Route>("dashboard");

  const [queue, setQueue] = useState<PracticeCard[]>([]);
  // Bumped per begun session so Practice remounts with fresh internal state
  // (its queue/outcomes are seeded from props on mount).
  const [sessionId, setSessionId] = useState(0);
  // "warmup" = explicit ahead-of-schedule practice: cards are shown and
  // retried, but grades are NOT applied — the schedule stays untouched.
  const [sessionMode, setSessionMode] = useState<"scheduled" | "warmup">("scheduled");
  const [report, setReport] = useState<EngineSessionReport | null>(null);
  // Word ids already covered earlier in the current study run (initial batch +
  // any restudy/next-batch continuations), so buildNextSession doesn't repeat them.
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);

  useEffect(() => saveDeck(deck), [deck]);
  useEffect(() => saveResults(results), [results]);

  // ── Accounts + cloud sync (optional; no-ops when Supabase isn't configured) ──
  const { user, configured } = useAuth();

  // Applies a merged remote+local snapshot after login (custom words are set
  // by the sync hook before this runs).
  const applyMerged = useCallback((state: AppState) => {
    setDeck(state.deck);
    setResults(state.results);
  }, []);

  useCloudSync({ userId: user?.id ?? null, deck, results, applyMerged });

  // Leave the auth screen automatically once a session arrives.
  useEffect(() => {
    if (user && route === "auth") setRoute("dashboard");
  }, [user, route]);

  async function handleSignOut() {
    await signOut();
    // Start the local session clean so the next account doesn't inherit this
    // deck; the signed-out user can still practise offline from here.
    setDeck([]);
    setResults([]);
    setCustomEntries([]);
    setRoute("dashboard");
  }

  // Resolve the deck (newest first) into full dictionary entries.
  const deckEntries = useMemo(
    () => deck.map((d) => resolveEntry(d.id)).filter((e): e is DictionaryEntry => Boolean(e)),
    [deck]
  );
  const deckIds = useMemo(() => new Set(deck.map((d) => d.id)), [deck]);

  // Ladder level per deck word, drives the mastery bars in Browse.
  const levels = useMemo(() => new Map(deck.map((d) => [d.id, d.level])), [deck]);

  // Leech words (4+ lapses) — tagged "Tricky" in lists, prioritized in sessions.
  const tricky = useMemo(() => new Set(deck.filter(isLeech).map((d) => d.id)), [deck]);

  // Consecutive practice days (today, or ending yesterday if today is pending).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streak = useMemo(() => streakDays(results, new Date()), [results, route]);

  const activeTab: Tab = useMemo(() => {
    if (route === "browse" || route === "settings") return route;
    return "dashboard";
  }, [route]);

  function toggleWord(entryId: string) {
    setDeck((prev) =>
      isInDeck(prev, entryId)
        ? prev.filter((d) => d.id !== entryId)
        : [newDeckItem(entryId, new Date()), ...prev]
    );
  }

  /** Save from the capture flow. Words from the online lookup aren't in the
   *  bundled dictionary, so they're persisted as custom entries first.
   *  `known` skips the ramp: straight to Mature (flowchart's "Already know it"). */
  function saveCapturedWord(entry: DictionaryEntry, known: boolean) {
    addCustomEntry(entry);
    setDeck((prev) => {
      if (isInDeck(prev, entry.id)) return prev;
      const now = new Date();
      const item = newDeckItem(entry.id, now);
      return [known ? { ...markAsKnown(item, now), dateAdded: item.dateAdded } : item, ...prev];
    });
    setRoute("dashboard");
  }

  // What the scheduler would practice right now — drives the hero's due count.
  // Recomputed on navigation too (route dep), so words that became due while
  // the app sat open show up when the user returns to the dashboard.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dueSession = useMemo(() => buildSession(deck, new Date()), [deck, route]);

  // When nothing is due: human label for the next unlock ("later today" / "tomorrow" / "in N days").
  const nextDueLabel = useMemo(() => {
    if (dueSession.length > 0 || deck.length === 0) return null;
    const soonest = Math.min(...deck.map((d) => new Date(d.dueDate).getTime()));
    const days = Math.ceil((soonest - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return "later today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  }, [deck, dueSession]);

  function beginSession(session: Word[], keepRun = false, mode: "scheduled" | "warmup" = "scheduled") {
    if (session.length === 0) return;
    setQueue(toPracticeCards(session));
    setSessionId((s) => s + 1);
    setSessionMode(mode);
    if (!keepRun) setReviewedIds([]);
    setRoute("practice");
  }

  function startPractice() {
    beginSession(dueSession);
  }

  // Explicit ahead-of-schedule practice (hero's "Practice ahead" when caught up):
  // the soonest-due words, even though they aren't due yet.
  function startPracticeAhead() {
    beginSession(
      [...deck]
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, SESSION_CAP),
      false,
      "warmup"
    );
  }

  function finishPractice(reviewedCards: ReviewedCard[]) {
    if (sessionMode === "warmup") {
      // Warm-up: informational report only — nothing is persisted.
      setReport(buildSessionReport(reviewedCards));
      setRoute("report");
      return;
    }
    setDeck((prev) => {
      const updated = new Map(reviewedCards.map((c) => [c.word.id, c.word]));
      return prev.map((d) => (updated.has(d.id) ? { ...updated.get(d.id)!, dateAdded: d.dateAdded } : d));
    });
    setResults((prev) => [
      ...prev,
      ...reviewedCards.map((c) => ({ entryId: c.word.id, grade: c.grade, timestamp: Date.now() })),
    ]);
    setReviewedIds((prev) => [...prev, ...reviewedCards.map((c) => c.word.id)]);
    setReport(buildSessionReport(reviewedCards));
    setRoute("report");
  }

  // Size of the batch "Continue to next N" would actually build right now —
  // drives the report screen's dynamic button label and its empty state.
  const nextSessionCount = useMemo(
    () => buildNextSession(deck, reviewedIds, new Date()).length,
    [deck, reviewedIds]
  );

  function continueToNext() {
    const words = buildNextSession(deck, reviewedIds, new Date());
    if (words.length === 0) {
      setRoute("dashboard");
      return;
    }
    beginSession(words, true);
  }

  // Drill the words missed this session again, right now. An ungraded
  // warm-up: they were already rescheduled sooner by the ladder when the
  // session was graded, so this repeat doesn't touch the schedule again.
  function reviewMissed() {
    if (!report) return;
    beginSession(buildRestudySession(report), true, "warmup");
  }

  const showTabs = !FOCUSED.includes(route);

  return (
    <div className="app-shell">
      <div className="phone">
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {route === "dashboard" && (
            <Dashboard
              deckCount={deckEntries.length}
              dueCount={dueSession.length}
              nextDueLabel={nextDueLabel}
              streak={streak}
              onPractice={startPractice}
              onPracticeAhead={startPracticeAhead}
              onAddWord={() => setRoute("capture")}
            />
          )}

          {route === "browse" && (
            <Browse
              entries={deckEntries}
              levels={levels}
              tricky={tricky}
              onRemove={toggleWord}
              onAddWord={() => setRoute("capture")}
            />
          )}

          {route === "settings" && (
            <Settings
              deckCount={deck.length}
              configured={configured}
              email={user?.email ?? null}
              onSignIn={() => setRoute("auth")}
              onSignOut={handleSignOut}
            />
          )}

          {route === "practice" && (
            <Practice key={sessionId} queue={queue} scheduling={sessionMode === "scheduled"} onFinish={finishPractice} onClose={() => setRoute("dashboard")} />
          )}

          {route === "report" && report && (
            <SessionReport
              report={report}
              streak={streak}
              warmup={sessionMode === "warmup"}
              nextCount={nextSessionCount}
              onContinue={continueToNext}
              onReviewMissed={reviewMissed}
              onBackToDashboard={() => setRoute("dashboard")}
            />
          )}

          {route === "capture" && (
            <Capture deckIds={deckIds} onSave={saveCapturedWord} onBack={() => setRoute("dashboard")} />
          )}

          {route === "auth" && <Auth onBack={() => setRoute("settings")} />}
        </div>

        {showTabs && <TabBar active={activeTab} onChange={(t) => setRoute(t)} />}
      </div>
    </div>
  );
}

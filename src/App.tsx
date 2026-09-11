import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./lib/types";
import { addCustomEntry, editEntry, getCustomEntries, resolveEntry, setCustomEntries } from "./lib/wordSources";
import {
  isInDeck,
  loadDailySet,
  loadDeck,
  loadResults,
  loadRun,
  newDeckItem,
  saveDailySet,
  saveDeck,
  saveResults,
  saveRun,
} from "./lib/storage";
import { isLeech, MAX_LEVEL, type Grade, type ReviewedCard, type Word } from "./lib/learningEngine";
import {
  buildDailySet,
  dayKey,
  DAILY_SET_SIZE,
  pruneRun,
  recordAnswer,
  runProgress,
  startRun,
  type DailySet,
  type PracticeRun,
} from "./lib/dailySet";
import { loadExamples, onExamplesLoaded } from "./data/examples";
import { expandOriginFrom, type ExpandOrigin } from "./lib/expandOrigin";
import { streakDays } from "./lib/streak";
import { useAuth } from "./lib/useAuth";
import { useCloudSync } from "./lib/useCloudSync";
import { signOut } from "./lib/auth";
import { pushState, type AppState } from "./lib/cloudState";
import { Dashboard } from "./screens/Dashboard";
import { Browse } from "./screens/Browse";
import { Practice, type PracticeCard } from "./screens/Practice";
import { SessionReport } from "./screens/SessionReport";
import { Capture } from "./screens/Capture";
import { AddChoice } from "./screens/AddChoice";
import { AddFromText } from "./screens/AddFromText";
import { Settings } from "./screens/Settings";
import { Auth } from "./screens/Auth";
import { NewPassword } from "./screens/NewPassword";
import { Welcome } from "./screens/Welcome";
import { TabBar, type Tab } from "./components/TabBar";

type Route = Tab | "practice" | "report" | "add-choice" | "capture" | "add-from-text";

const FOCUSED: Route[] = ["practice", "report", "add-choice", "capture", "add-from-text"];

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
  // The day's drawn batch of words. Persisted and synced, because half a set
  // done on the phone has to still be half a set done on the laptop.
  // Drawn during the very first render, not in an effect: an effect would
  // paint one frame with no set at all, which reads as the caught-up card
  // before flipping to the real one. `deck` is already initialised above.
  const [dailySet, setDailySet] = useState<DailySet | null>(() => {
    const saved = loadDailySet();
    const today = dayKey(new Date());
    if (saved && saved.date === today && saved.wordIds.length > 0) return saved;
    return buildDailySet(deck, new Date());
  });
  // What the user actually did, in their current or most recent sitting.
  // The dashboard's practice card reads this and nothing else.
  const [run, setRun] = useState<PracticeRun | null>(() => loadRun());
  const [route, setRoute] = useState<Route>("dashboard");

  // Access gate flow (Figma 228:1789): a signed-out visitor lands on the
  // Welcome choice screen first, then Auth in whichever mode they picked.
  // Signing out skips straight back to "signin" (see handleSignOut) rather
  // than replaying Welcome.
  const [authStep, setAuthStep] = useState<"welcome" | "auth">("welcome");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Where the Add-a-word screen should expand from (Material's container
  // transform). Null when it was opened some other way — then it just appears.
  const [expandFrom, setExpandFrom] = useState<ExpandOrigin | null>(null);

  const [queue, setQueue] = useState<PracticeCard[]>([]);
  // Bumped per begun session so Practice remounts with fresh internal state
  // (its queue/outcomes are seeded from props on mount).
  const [sessionId, setSessionId] = useState(0);
  // "warmup" = a re-drill, or practice ahead of schedule. The answers are
  // still recorded into the run (the card must report what actually
  // happened), but they are NOT graded onto the ladder: those words were
  // already scheduled by their first answer today, and grading the same
  // recall twice would move a word several levels in one sitting.
  const [sessionMode, setSessionMode] = useState<"scheduled" | "warmup">("scheduled");

  useEffect(() => saveDeck(deck), [deck]);
  useEffect(() => saveResults(results), [results]);
  useEffect(() => saveDailySet(dailySet), [dailySet]);
  useEffect(() => saveRun(run), [run]);

  // Example sentences are a separate chunk (they're most of the dictionary's
  // weight and none of what the first screen needs). Fetch them as soon as
  // the app is interactive, and re-render when they land so anything already
  // on screen picks up its sentence.
  const [examplesVersion, setExamplesVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = onExamplesLoaded(() => setExamplesVersion((v) => v + 1));
    void loadExamples();
    return unsubscribe;
  }, []);

  // Bumped whenever a word's saved content changes without the deck itself
  // changing (editEntry) — deckEntries otherwise has no reason to recompute,
  // since neither `deck` (ladder state) nor `examplesVersion` moved.
  const [customWordsVersion, setCustomWordsVersion] = useState(0);

  // ── Accounts + cloud sync (optional; no-ops when Supabase isn't configured) ──
  const { user, configured, ready, recovering, clearRecovery } = useAuth();

  // Hard access gate (Figma 228:1789): signed-out visitors can't reach any
  // part of the app — no offline browsing, no "continue without an
  // account" skip. Only takes effect when Supabase is configured; an
  // unconfigured build has no accounts to gate behind, so it stays fully
  // offline as before.
  const locked = configured && !user;

  // Applies a merged remote+local snapshot after login (custom words are set
  // by the sync hook before this runs).
  const applyMerged = useCallback((state: AppState) => {
    setDeck(state.deck);
    setResults(state.results);
    setDailySet(state.dailySet);
    setRun(state.run);
  }, []);

  useCloudSync({ userId: user?.id ?? null, deck, results, dailySet, run, applyMerged });

  // Whenever the gate (re)closes — sign-out, or a session expiring — drop
  // back to the dashboard so the next sign-in doesn't resume a stale
  // mid-flow screen (e.g. a cleared practice queue).
  useEffect(() => {
    if (locked) setRoute("dashboard");
  }, [locked]);

  async function handleSignOut() {
    // Flush the latest state before signing out: the debounced push (see
    // useCloudSync) may not have fired yet for the last few seconds of
    // progress, and it's about to be wiped from local storage below. Must
    // happen while still authenticated — RLS needs auth.uid() = user_id.
    if (user) {
      await pushState(user.id, { deck, results, dailySet, run, customWords: getCustomEntries() });
    }
    await signOut();
    // Start the local session clean so the next account doesn't inherit this
    // deck.
    setDeck([]);
    setResults([]);
    setDailySet(null);
    setRun(null);
    setCustomEntries([]);
    // Straight back to log-in, not Welcome — this visitor already knows
    // the app, and has an account by definition.
    setAuthMode("signin");
    setAuthStep("auth");
  }

  // Resolve the deck (newest first) into full dictionary entries. Recomputed
  // when the examples chunk lands (rows pick up their sentence) or a word's
  // content is edited in place (customWordsVersion).
  const deckEntries = useMemo(
    () => deck.map((d) => resolveEntry(d.id)).filter((e): e is DictionaryEntry => Boolean(e)),
    [deck, examplesVersion, customWordsVersion]
  );
  const deckIds = useMemo(() => new Set(deck.map((d) => d.id)), [deck]);

  /** Corrects a saved translation — same override mechanism the sense picker
   *  uses, offered generally rather than only where a second sense exists. */
  function editDeckWord(id: string, edit: { english: string; example: string; exampleEn: string }) {
    editEntry(id, edit);
    setCustomWordsVersion((v) => v + 1);
  }

  // Ladder level per deck word, drives the mastery bars in Browse.
  const levels = useMemo(() => new Map(deck.map((d) => [d.id, d.level])), [deck]);

  // Leech words (4+ lapses) — tagged "Tricky" in lists, prioritized in sessions.
  const tricky = useMemo(() => new Set(deck.filter(isLeech).map((d) => d.id)), [deck]);

  // Words at the top of the ladder — the dashboard's mastery bar fills to this.
  const masteredCount = useMemo(() => deck.filter((d) => d.level >= MAX_LEVEL).length, [deck]);

  // Consecutive practice days (today, or ending yesterday if today is pending).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streak = useMemo(() => streakDays(results, new Date()), [results, route]);

  const activeTab: Tab = useMemo(() => {
    if (route === "browse" || route === "settings") return route;
    return "dashboard";
  }, [route]);

  /** The + button and the empty dashboard's CTA both open the fork between
   *  the two ways in (AddChoice), not the search field directly — the
   *  reading route was previously only findable from inside Capture. */
  function openAdd(origin: HTMLElement) {
    setExpandFrom(expandOriginFrom(origin));
    setRoute("add-choice");
  }

  function toggleWord(entryId: string) {
    setDeck((prev) =>
      isInDeck(prev, entryId)
        ? prev.filter((d) => d.id !== entryId)
        : [newDeckItem(entryId, new Date()), ...prev]
    );
  }

  /** Save from the capture flow. Words from the online lookup aren't in the
   *  bundled dictionary, so they're persisted as custom entries first.
   *
   *  Deliberately does not navigate: the capture screen confirms the save
   *  itself and clears for the next word. Landing on the deck after every
   *  add cost four taps per word on a task that asks for three. */
  function saveCapturedWord(entry: DictionaryEntry) {
    addCustomEntry(entry);
    setDeck((prev) =>
      isInDeck(prev, entry.id) ? prev : [newDeckItem(entry.id, new Date()), ...prev]
    );
  }

  // Today, recomputed on navigation so a day boundary crossed with the app
  // left open is noticed. Both the set and the run are scoped to it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => dayKey(new Date()), [route]);

  // ── The day's set ──
  // Drawn once per local calendar day and then left alone, so a half-finished
  // set resumes on the same words rather than being re-derived from a
  // schedule those very answers have already moved.
  //
  // Two things trigger a draw: the date rolling over, and a day that was
  // drawn while the deck had nothing to offer (the first word of the day
  // added afterwards should not have to wait until tomorrow). Keyed on
  // `route` as well so a day boundary crossed with the app left open is
  // picked up when the user navigates back.
  useEffect(() => {
    const isToday = dailySet?.date === today;

    if (isToday && dailySet.wordIds.length > 0) {
      // A word deleted from the deck part-way through the day would otherwise
      // leave the set impossible to finish: it keeps counting as "to go"
      // while there is no card left to answer it with.
      const inDeck = new Set(deck.map((d) => d.id));
      const kept = dailySet.wordIds.filter((id) => inDeck.has(id));
      if (kept.length !== dailySet.wordIds.length) setDailySet({ date: today, wordIds: kept });
      return;
    }

    const drawn = buildDailySet(deck, new Date());
    // Still nothing to draw: leave today's empty set alone rather than
    // replacing it with an identical one every render.
    if (isToday && drawn.wordIds.length === 0) return;
    setDailySet(drawn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, dailySet, today]);

  // Same treatment for the run: a word removed from the deck must not leave
  // the sitting stuck one card short of finishing.
  useEffect(() => {
    if (!run || run.date !== today) return;
    const inDeck = new Set(deck.map((d) => d.id));
    const pruned = pruneRun(run, (id) => inDeck.has(id));
    if (pruned !== run) setRun(pruned);
  }, [deck, run, today]);

  // Words drawn for today. Drives "N words are ready" and "Practise all N
  // again" — the size of the day, independent of any one sitting.
  const setSize = dailySet?.date === today ? dailySet.wordIds.length : 0;

  // What the user actually did. The card reads this and nothing else.
  const progress = useMemo(() => runProgress(run, today), [run, today]);

  // Shown only when there was nothing to draw: when the next word unlocks
  // ("later today" / "tomorrow" / "in N days").
  const nextDueLabel = useMemo(() => {
    if (setSize > 0 || deck.length === 0) return null;
    const soonest = Math.min(...deck.map((d) => new Date(d.dueDate).getTime()));
    const days = Math.ceil((soonest - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return "later today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  }, [deck, setSize]);

  /** Deck items for the given ids, in the order given (missing ids dropped). */
  const wordsFor = useCallback(
    (ids: string[]): Word[] => {
      const byId = new Map(deck.map((d) => [d.id, d]));
      return ids.map((id) => byId.get(id)).filter((w): w is DeckItem => Boolean(w));
    },
    [deck]
  );

  /** Puts a list of words on screen as a practice queue.
   *
   *  `nextRun` is the run this sitting is recording into. Resuming passes the
   *  run already in progress; every other entry point passes a fresh one, so
   *  a new sitting always starts from a clean slate rather than inheriting
   *  the previous result. */
  function beginSession(
    words: Word[],
    nextRun: PracticeRun,
    mode: "scheduled" | "warmup" = "scheduled"
  ) {
    if (words.length === 0) return;
    setRun(nextRun);
    setQueue(toPracticeCards(words));
    setSessionId((s) => s + 1);
    setSessionMode(mode);
    setRoute("practice");
  }

  /** Starts today's set — or resumes it, when a sitting is already part-way
   *  through. Resuming keeps the same run so the answers already given still
   *  count; starting fresh replaces it. */
  function startPractice() {
    const resumable = run && run.date === today && progress.status === "progress";
    if (resumable) {
      beginSession(wordsFor(progress.remaining), run);
      return;
    }
    const ids = dailySet?.date === today ? dailySet.wordIds : [];
    beginSession(wordsFor(ids), startRun(ids, new Date()));
  }

  // ── Re-drills, offered once a sitting is finished. Each is a new run, so
  //    the card reports what just happened rather than keeping the older,
  //    possibly better, result.
  //
  //    They are warm-ups as far as the *scheduler* is concerned: every word
  //    was already graded onto the ladder when it was first answered today,
  //    and grading the same recall twice would let one sitting move a word
  //    several levels. The run still records the answers — that is what the
  //    card reads — so a re-drill that goes badly is reported as such. ──
  function practiseLearningAgain() {
    const ids = progress.learningIds;
    beginSession(wordsFor(ids), startRun(ids, new Date()), "warmup");
  }

  function practiseAllAgain() {
    const ids = dailySet?.date === today ? dailySet.wordIds : [];
    beginSession(wordsFor(ids), startRun(ids, new Date()), "warmup");
  }

  // Nothing was available to draw today: the soonest-due words, even though
  // they aren't due yet. A warm-up, so it doesn't disturb the schedule.
  function startPracticeAhead() {
    const ids = [...deck]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, DAILY_SET_SIZE)
      .map((d) => d.id);
    beginSession(wordsFor(ids), startRun(ids, new Date()), "warmup");
  }

  /** Writes one answer the moment it's given: the word's new ladder state,
   *  and a row in the practice log. Both effects above persist on change, so
   *  a session abandoned half-way keeps everything answered up to that point
   *  — nothing waits for the session to be finished. Each attempt is logged,
   *  including in-session retries, which is what the ladder already grades. */
  /** Records an answer into the run — every answer, warm-up included. This
   *  is the only thing the dashboard's practice card reads, so it has to see
   *  the sitting the user is actually doing, not just the graded ones. */
  const recordRunAnswer = useCallback((wordId: string, grade: Grade) => {
    setRun((prev) => (prev ? recordAnswer(prev, wordId, grade) : prev));
  }, []);

  const persistGrade = useCallback(({ word, grade }: ReviewedCard) => {
    setDeck((prev) =>
      prev.map((d) => (d.id === word.id ? { ...word, dateAdded: d.dateAdded } : d))
    );
    setResults((prev) => [...prev, { entryId: word.id, grade, timestamp: Date.now() }]);
  }, []);

  /** Finishing a sitting ALWAYS lands on the result screen — every sitting,
   *  however it went: a perfect run, an all-wrong run, the day's set or a
   *  re-drill. It is the last step of the flow, and only the user leaving it
   *  returns them to the dashboard.
   *
   *  Answers were already recorded one by one (recordRunAnswer / persistGrade),
   *  so this only has to navigate — there is no result to assemble here that
   *  could disagree with what the card will show. */
  function finishPractice() {
    setRoute("report");
  }

  // Recovery renders in place of the app, so it gets no navigation either —
  // the session is signed in, which would otherwise leave the tab bar showing
  // under a screen that isn't part of the app.
  const showTabs = !locked && !recovering && !FOCUSED.includes(route);

  // The FAB is the shortcut to Add-a-word — so it's dropped wherever the
  // screen already puts that action in front of the user (the empty
  // dashboard's "Add your first word"), and on Settings, where it's moot.
  const emptyDashboard = route === "dashboard" && deckEntries.length === 0;
  const showFab = activeTab !== "settings" && !emptyDashboard;

  return (
    <div className="app-shell">
      <div className="phone">
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {configured && !ready ? null : recovering ? (
            // A recovery link signs the user in, so this has to take
            // precedence over the normal signed-in app — otherwise the
            // password they came to change never gets changed.
            <NewPassword onDone={clearRecovery} />
          ) : locked ? (
            // The boot splash (main.tsx) covers this in practice — Supabase's
            // local-storage session read resolves well within its hold time.
            authStep === "welcome" ? (
              <Welcome
                onCreateAccount={() => {
                  setAuthMode("signup");
                  setAuthStep("auth");
                }}
                onLogIn={() => {
                  setAuthMode("signin");
                  setAuthStep("auth");
                }}
              />
            ) : (
              <Auth initialMode={authMode} onBack={() => setAuthStep("welcome")} />
            )
          ) : (
            <>
              {route === "dashboard" && (
                <Dashboard
                  deckCount={deckEntries.length}
                  masteredCount={masteredCount}
                  setSize={setSize}
                  progress={progress}
                  nextDueLabel={nextDueLabel}
                  streak={streak}
                  onPractice={startPractice}
                  onPractiseLearning={practiseLearningAgain}
                  onPractiseAll={practiseAllAgain}
                  onPracticeAhead={startPracticeAhead}
                  onAddWord={openAdd}
                />
              )}

              {route === "browse" && (
                <Browse
                  entries={deckEntries}
                  levels={levels}
                  tricky={tricky}
                  deckIds={deckIds}
                  onRemove={toggleWord}
                  onEdit={editDeckWord}
                  onSave={saveCapturedWord}
                />
              )}

              {route === "settings" && (
                <Settings
                  deckCount={deck.length}
                  configured={configured}
                  email={user?.email ?? null}
                  onSignOut={handleSignOut}
                />
              )}

              {route === "practice" && (
                <Practice
                  key={sessionId}
                  queue={queue}
                  scheduling={sessionMode === "scheduled"}
                  onAnswer={recordRunAnswer}
                  onGrade={persistGrade}
                  onFinish={finishPractice}
                  // Leaving part-way is not finishing: the run keeps the
                  // answers given so far and stays resumable, so the card
                  // reports "in progress" rather than a result.
                  onClose={() => setRoute("dashboard")}
                />
              )}

              {route === "report" && (
                <SessionReport
                  knownIds={progress.knownIds}
                  learningIds={progress.learningIds}
                  deck={deck}
                  streak={streak}
                  warmup={sessionMode === "warmup"}
                  onReviewMissed={practiseLearningAgain}
                  onBackToDashboard={() => setRoute("dashboard")}
                />
              )}

              {/* The container transform belongs to whichever screen the +
                  button actually opens — now the chooser, not Capture. The
                  two screens it leads to are reached from within the flow,
                  so they just appear. */}
              {route === "add-choice" && (
                <div
                  className={expandFrom ? "screen-expand" : undefined}
                  style={
                    expandFrom
                      ? ({
                          "--expand-x": `${expandFrom.x}px`,
                          "--expand-y": `${expandFrom.y}px`,
                          "--expand-r": `${expandFrom.r}px`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <AddChoice
                    onSingleWord={() => setRoute("capture")}
                    onFullSentence={() => setRoute("add-from-text")}
                    onBack={() => setRoute("dashboard")}
                  />
                </div>
              )}

              {route === "capture" && (
                <Capture
                  deckIds={deckIds}
                  levels={levels}
                  onSave={saveCapturedWord}
                  onUndo={(entryId) => setDeck((prev) => prev.filter((d) => d.id !== entryId))}
                  onViewDeck={() => setRoute("browse")}
                  onBack={() => setRoute("add-choice")}
                />
              )}

              {route === "add-from-text" && (
                <AddFromText
                  deckIds={deckIds}
                  levels={levels}
                  onSave={saveCapturedWord}
                  onBack={() => setRoute("add-choice")}
                />
              )}
            </>
          )}
        </div>

        {showTabs && (
          <TabBar active={activeTab} onChange={(t) => setRoute(t)} onAddWord={showFab ? openAdd : undefined} />
        )}
      </div>
    </div>
  );
}

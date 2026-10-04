import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DeckItem, DictionaryEntry } from "./lib/types";
import {
  addCustomEntry,
  editEntry,
  pinSenseEntries,
  resolveEntry,
  setCustomEntries,
  useCustomEntriesVersion,
} from "./lib/wordSources";
import { isInDeck, loadOwner, newDeckItem } from "./lib/storage";
import { setSizeFor, useAppState } from "./lib/useAppState";
import { useToday } from "./lib/useToday";
import { isLeech, MAX_LEVEL, type Grade, type ReviewedCard, type Word } from "./lib/learningEngine";
import {
  buildDailySet,
  dayKey,
  pruneRun,
  recordAnswer,
  recordCleared,
  runProgress,
  startRun,
} from "./lib/dailySet";
import {
  backfillDoneDays,
  commitmentOf,
  currentStreak,
  cueLine,
  EXTRA_ROUND_WORDS,
  isReturning,
  newHabit,
  reflectionDue,
  RETURN_WARMUP_WORDS,
  todayProgress,
  todaysGoal,
  weekProgress,
  wordsPractisedOn,
  type Commitment,
  type HabitTime,
} from "./lib/habit";
import { buildReflection, hasSomethingToShow } from "./lib/reflection";
import { useDailyReminder } from "./lib/reminders";
import { STARTER_WORDS } from "./data/starterWords";
import { loadExamples, onExamplesLoaded } from "./data/examples";
import { expandOriginFrom, type ExpandOrigin } from "./lib/expandOrigin";
import { useAuth } from "./lib/useAuth";
import { useCloudSync } from "./lib/useCloudSync";
import { signOut } from "./lib/auth";
import { Dashboard } from "./screens/Dashboard";
import { Browse } from "./screens/Browse";
import { Practice, type PracticeCard } from "./screens/Practice";
import { SessionReport, type SittingKind } from "./screens/SessionReport";
import { Onboarding } from "./screens/Onboarding";
import { Reflection } from "./screens/Reflection";
import { WeeklyGoal } from "./screens/WeeklyGoal";
import { WelcomeBack } from "./components/WelcomeBack";
import { Capture } from "./screens/Capture";
import { AddChoice } from "./screens/AddChoice";
import { AddFromText } from "./screens/AddFromText";
import { Settings, type HabitPrefs } from "./screens/Settings";
import { Auth } from "./screens/Auth";
import { NewPassword } from "./screens/NewPassword";
import { Welcome } from "./screens/Welcome";
import { TabBar, type Tab } from "./components/TabBar";

type Route = Tab | "practice" | "report" | "reflection" | "week" | "add-choice" | "capture" | "add-from-text";

const FOCUSED: Route[] = ["practice", "report", "reflection", "week", "add-choice", "capture", "add-from-text"];

/* How long to wait for a signed-in user's remote habit before showing
   onboarding anyway. A failed pull stops the wait at once (offline); this
   only bounds a request that neither lands nor fails. Kept generous: showing
   onboarding to a returning user on a slow connection would seed a starter
   deck that the late merge then adds to their real one. */
const HYDRATION_GRACE_MS = 15_000;

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
  const {
    deck,
    setDeck,
    results,
    setResults,
    habit,
    setHabit,
    dailySet,
    setDailySet,
    run,
    setRun,
    applyMerged,
    reset,
  } = useAppState();
  const { today, now } = useToday();
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
  // What the sitting on screen is for — the report words itself by it.
  const [sittingKind, setSittingKind] = useState<SittingKind>("goal");

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

  // Moves whenever a word's saved content changes without the deck itself
  // changing (an edit, or custom words arriving by sync).
  const customWordsVersion = useCustomEntriesVersion();

  // ── Accounts + cloud sync (optional; no-ops when Supabase isn't configured) ──
  const { user, configured, ready, recovering, clearRecovery } = useAuth();

  // Hard access gate (Figma 228:1789): signed-out visitors can't reach any
  // part of the app — no offline browsing, no "continue without an
  // account" skip. Only takes effect when Supabase is configured; an
  // unconfigured build has no accounts to gate behind, so it stays fully
  // offline as before.
  const locked = configured && !user;

  const { hydrated, hydrationFailed, flush } = useCloudSync({
    userId: user?.id ?? null,
    deck,
    results,
    dailySet,
    run,
    habit,
    applyMerged,
  });

  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const t = window.setTimeout(() => setGraceOver(true), HYDRATION_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [hydrated]);

  // Whenever the gate (re)closes — sign-out, or a session expiring — drop
  // back to the dashboard so the next sign-in doesn't resume a stale
  // mid-flow screen (e.g. a cleared practice queue).
  useEffect(() => {
    if (locked) setRoute("dashboard");
  }, [locked]);

  /** Signs out, wiping this device's copy. Resolves false — and does nothing
   *  — when the latest progress couldn't be saved first, unless `force`d:
   *  the wipe would otherwise destroy the only copy of it. */
  async function handleSignOut({ force = false } = {}): Promise<boolean> {
    // Must happen while still authenticated — RLS needs auth.uid() = user_id.
    const saved = await flush();
    if (!saved && !force) return false;
    await signOut();
    reset();
    setCustomEntries([]);
    // Straight back to log-in, not Welcome — this visitor already knows
    // the app, and has an account by definition.
    setAuthMode("signin");
    setAuthStep("auth");
    return true;
  }

  // Resolve the deck (newest first) into full dictionary entries. Recomputed
  // when the examples chunk lands (rows pick up their sentence) or a word's
  // content is edited in place (customWordsVersion).
  const deckEntries = useMemo(
    () => deck.map((d) => resolveEntry(d.id)).filter((e): e is DictionaryEntry => Boolean(e)),
    // The versions stand in for resolveEntry's module-level stores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, examplesVersion, customWordsVersion]
  );
  const deckIds = useMemo(() => new Set(deck.map((d) => d.id)), [deck]);

  // The deck words that can actually be shown — what every count and draw
  // works from. A word whose entry no longer resolves (a headword since
  // dropped from the dictionary) keeps its place in the deck, in case it
  // comes back, but can't be asked: counting it would leave the day's goal
  // forever one word out of reach.
  const activeDeck = useMemo(
    () => deck.filter((d) => resolveEntry(d.id) !== undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, customWordsVersion]
  );

  // Secondary meanings are keyed by their position in a word's sense list,
  // which a dictionary update can shift — so each one in the deck keeps its
  // own copy of the meaning that was saved.
  useEffect(() => pinSenseEntries(deck.map((d) => d.id)), [deck]);

  /** Corrects a saved translation — same override mechanism the sense picker
   *  uses, offered generally rather than only where a second sense exists. */
  function editDeckWord(id: string, edit: { english: string; example: string; exampleEn: string }) {
    editEntry(id, edit);
  }

  // Ladder level per deck word, drives the mastery bars in Browse.
  const levels = useMemo(() => new Map(deck.map((d) => [d.id, d.level])), [deck]);

  // Leech words (4+ lapses) — tagged "Tricky" in lists, prioritized in sessions.
  const tricky = useMemo(() => new Set(deck.filter(isLeech).map((d) => d.id)), [deck]);

  // Words at the top of the ladder — the dashboard's mastery bar fills to this.
  const masteredCount = useMemo(() => activeDeck.filter((d) => d.level >= MAX_LEVEL).length, [activeDeck]);

  const activeTab: Tab = useMemo(() => {
    if (route === "browse" || route === "settings") return route;
    return "dashboard";
  }, [route]);

  /** The + button and the empty dashboard's CTA both open the fork between
   *  the two ways in (AddChoice), not the search field directly, so the
   *  reading route is as easy to find as the single-word one. */
  function openAdd(origin: HTMLElement) {
    setExpandFrom(expandOriginFrom(origin));
    setRoute("add-choice");
  }

  /** Takes a word out of the deck, handing back what was removed — its
   *  ladder state included — so the deck screen can offer an undo. */
  function removeWord(entryId: string): DeckItem | undefined {
    const removed = deck.find((d) => d.id === entryId);
    setDeck((prev) => prev.filter((d) => d.id !== entryId));
    return removed;
  }

  /** Puts a removed word back exactly as it was. */
  function restoreWord(item: DeckItem) {
    setDeck((prev) =>
      isInDeck(prev, item.id) ? prev : [...prev, item].sort((a, b) => b.dateAdded - a.dateAdded)
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

  // The day's set is sized to the commitment — 10, 20 or 30 words — not to
  // a fixed number. That is the whole of "how much Dutch fits your day".
  const setTarget = setSizeFor(habit);

  // Distinct words graded today. Re-drills are ungraded, so they don't count;
  // a word answered twice counts once.
  const practisedToday = useMemo(() => wordsPractisedOn(results, today), [results, today]);
  const practisedSet = useMemo(() => new Set(practisedToday), [practisedToday]);

  // ── The day's set ──
  // Drawn once per local calendar day and then left alone, so a half-finished
  // set resumes on the same words rather than being re-derived from a
  // schedule those very answers have already moved.
  //
  // Three things trigger a draw: the date rolling over; a day that was drawn
  // while the deck had nothing to offer (the first word of the day added
  // afterwards should not have to wait until tomorrow); and the commitment
  // changing before anything was practised today, so switching Espresso to
  // Diner in Settings takes effect at once.
  useEffect(() => {
    const isToday = dailySet?.date === today;
    const wanted = Math.min(setTarget, activeDeck.length);

    if (isToday && dailySet.wordIds.length > 0) {
      // A word deleted from the deck part-way through the day would otherwise
      // leave the set impossible to finish: it keeps counting as "to go"
      // while there is no card left to answer it with.
      const inDeck = new Set(activeDeck.map((d) => d.id));
      const kept = dailySet.wordIds.filter((id) => inDeck.has(id));
      if (kept.length !== dailySet.wordIds.length) {
        setDailySet({ date: today, wordIds: kept });
        return;
      }
      if (kept.length === wanted || practisedToday.length > 0) return;
    }

    const drawn = buildDailySet(activeDeck, new Date(), setTarget);
    // Still nothing to draw: leave today's empty set alone rather than
    // replacing it with an identical one every render.
    if (isToday && drawn.wordIds.length === 0) return;
    setDailySet(drawn);
  }, [activeDeck, dailySet, today, setTarget, practisedToday.length, setDailySet]);

  // Same treatment for the run: a word removed from the deck must not leave
  // the sitting stuck one card short of finishing.
  useEffect(() => {
    if (!run || run.date !== today) return;
    const inDeck = new Set(activeDeck.map((d) => d.id));
    const pruned = pruneRun(run, (id) => inDeck.has(id));
    if (pruned !== run) setRun(pruned);
  }, [activeDeck, run, today, setRun]);

  // What the user actually did in the sitting on screen (or the last one) —
  // the report reads this.
  const progress = useMemo(() => runProgress(run, today), [run, today]);

  // Words graded today but not yet got right: missed, and the sitting was
  // left before they came back round. A word only counts once it's right.
  const outstanding = useMemo(
    () => progress.outstanding.filter((id) => practisedSet.has(id)),
    [progress.outstanding, practisedSet]
  );

  // ── Today's goal ──
  const goal = habit
    ? todaysGoal(habit, activeDeck.length, today)
    : Math.max(1, Math.min(setTarget, activeDeck.length));
  const alreadyDone = habit?.doneDays.includes(today) ?? false;
  const completedToday = practisedToday.length - outstanding.length;
  const todayProg = useMemo(
    () => todayProgress(goal, completedToday, alreadyDone),
    [goal, completedToday, alreadyDone]
  );

  // Record the day the moment its goal is reached. Recorded, not re-derived
  // later, so a change of commitment can never un-complete a past day.
  useEffect(() => {
    if (!habit || !todayProg.done || alreadyDone || activeDeck.length === 0) return;
    setHabit((prev) =>
      prev && !prev.doneDays.includes(today) ? { ...prev, doneDays: [...prev.doneDays, today] } : prev
    );
  }, [habit, todayProg.done, alreadyDone, today, activeDeck.length, setHabit]);

  const week = useMemo(
    () => weekProgress(habit?.doneDays ?? [], habit?.weeklyTarget ?? 4, now),
    [habit?.doneDays, habit?.weeklyTarget, now]
  );

  const streak = useMemo(() => currentStreak(habit?.doneDays ?? [], now), [habit?.doneDays, now]);

  useDailyReminder(habit, todayProg.done);

  // Extra practice is always on offer once there's a deck: new words while
  // any are left, then an ungraded review of today's (see startExtra).
  const canExtra = activeDeck.length > 0;

  // Words met for the very first time today, by name — what the report
  // shows as today's gain.
  const newToday = useMemo(() => {
    const first = new Map<string, number>();
    for (const r of results) {
      const t = first.get(r.entryId);
      if (t === undefined || r.timestamp < t) first.set(r.entryId, r.timestamp);
    }
    const names = [...first]
      .filter(([, t]) => dayKey(new Date(t)) === today)
      .map(([id]) => resolveEntry(id)?.dutch)
      .filter((w): w is string => Boolean(w));
    return [...new Set(names)];
    // customWordsVersion: a synced custom word can change the name shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, today, customWordsVersion]);

  // ── Monthly "then vs now" ──
  // Only built when due — it walks the whole log.
  const reflection = useMemo(() => {
    if (!habit || !reflectionDue(habit, now)) return null;
    const r = buildReflection(results, now, (id) => resolveEntry(id)?.dutch);
    return hasSomethingToShow(r) ? r : null;
  }, [habit, results, now]);

  /** Deck items for the given ids, in the order given (missing ids dropped). */
  const wordsFor = useCallback(
    (ids: string[]): Word[] => {
      const byId = new Map(activeDeck.map((d) => [d.id, d]));
      return ids.map((id) => byId.get(id)).filter((w): w is DeckItem => Boolean(w));
    },
    [activeDeck]
  );

  /** Puts a list of words on screen as a practice queue. Every sitting is a
   *  fresh run, so its report shows what just happened and nothing older. */
  function beginSession(words: Word[], kind: SittingKind) {
    // Words whose entry can't be resolved (a headword since dropped from the
    // dictionary, say) have no card to show, so they're left out of the
    // sitting — and of the run, which would otherwise wait for them forever.
    const cards = toPracticeCards(words);
    if (cards.length === 0) return;
    const ids = cards.map((c) => c.word.id);
    // A re-drill doesn't count toward the day, so it tracks nothing as
    // outstanding: leaving one part-way can't take the day backwards.
    setRun(startRun(ids, new Date(), kind !== "warmup"));
    setQueue(cards);
    setSessionId((s) => s + 1);
    setSessionMode(kind === "warmup" ? "warmup" : "scheduled");
    setSittingKind(kind);
    setRoute("practice");
  }

  /** The next `count` words toward today: words missed and not yet got right
   *  first, then today's set (skipping what's already been practised),
   *  topped up from the deck if the set runs out. */
  function nextWords(count: number, from: DeckItem[] = activeDeck, set: string[] | null = null): Word[] {
    if (count <= 0) return [];
    const setIds = set ?? (dailySet?.date === today ? dailySet.wordIds : []);
    const ids = [...outstanding, ...setIds.filter((id) => !practisedSet.has(id))].slice(0, count);
    if (ids.length < count) {
      const taken = new Set([...ids, ...practisedSet]);
      const rest = from.filter((d) => !taken.has(d.id));
      ids.push(...buildDailySet(rest, new Date(), count - ids.length).wordIds);
    }
    const byId = new Map(from.map((d) => [d.id, d]));
    return ids.map((id) => byId.get(id)).filter((w): w is DeckItem => Boolean(w));
  }

  /** Starts today's goal — or continues it. "Continue" is simply the words
   *  still needed: answers already given today are kept, whichever sitting
   *  they came from. */
  function startPractice() {
    beginSession(nextWords(goal - todayProg.towardGoal), "goal");
  }

  /** A few more, past the goal. Graded like any other answer — it's real
   *  learning — but the goal itself never moves because of it. */
  function startExtra() {
    const rest = activeDeck.filter((d) => !practisedSet.has(d.id));
    if (rest.length > 0) {
      const ids = buildDailySet(rest, new Date(), EXTRA_ROUND_WORDS).wordIds;
      beginSession(wordsFor(ids), "extra");
      return;
    }
    // Every word has had its graded answer today, so more practice is a
    // review: ungraded, drawn from the words due back soonest (the weakest),
    // shuffled so pressing again doesn't repeat the same round.
    const weakest = [...activeDeck]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, EXTRA_ROUND_WORDS * 3);
    for (let i = weakest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weakest[i], weakest[j]] = [weakest[j], weakest[i]];
    }
    beginSession(weakest.slice(0, EXTRA_ROUND_WORDS), "warmup");
  }

  /** Re-drills the words just missed. Ungraded: they were scheduled by their
   *  first answer today, and grading the same recall twice would let one
   *  sitting move a word several levels. */
  function practiseLearningAgain() {
    beginSession(wordsFor(progress.learningIds), "warmup");
  }

  // ── Coming back ──
  // One warm popup after time away. Opening it (either button) makes today
  // a return day, whose goal is the 5-word warm-up — so coming back is
  // finished in one small step.
  const showWelcomeBack =
    route === "dashboard" &&
    habit !== null &&
    activeDeck.length > 0 &&
    practisedToday.length === 0 &&
    isReturning(habit, results, now);

  function welcomeBack(start: boolean) {
    if (!habit) return;
    setHabit({ ...habit, welcomedOn: today });
    if (start) beginSession(nextWords(Math.min(RETURN_WARMUP_WORDS, goal)), "goal");
  }

  // ── Onboarding ──
  function completeOnboarding(choice: { commitment: Commitment; time: HabitTime }) {
    const now = new Date();
    const words = commitmentOf(choice.commitment).words;

    // A new learner gets a starter deck, so the first session can start now
    // rather than after adding words by hand. Newest-first, in list order,
    // so the first words of the list are the first ones practised.
    let nextDeck = activeDeck;
    if (deck.length === 0) {
      nextDeck = STARTER_WORDS.filter((id) => resolveEntry(id)).map((id, i) => ({
        ...newDeckItem(id, now),
        dateAdded: now.getTime() - i,
      }));
      setDeck(nextDeck);
    }

    // An existing learner's recent practice shows on their first week.
    const next = newHabit(choice, now);
    next.doneDays = backfillDoneDays(results, words);
    setHabit(next);

    const set = buildDailySet(nextDeck, now, words);
    setDailySet(set);
    beginSession(nextWords(words, nextDeck, set.wordIds), "goal");
  }

  function changeHabit(prefs: Partial<HabitPrefs>) {
    setHabit((prev) => (prev ? { ...prev, ...prefs, updatedAt: Date.now() } : prev));
  }

  function finishReflection() {
    setHabit((prev) => (prev ? { ...prev, lastReflection: today } : prev));
    setRoute("dashboard");
  }

  /** Records an answer into the run — every answer, warm-up included. The
   *  report reads the run, so it has to see the sitting the user is actually
   *  doing, not just the graded ones. */
  const recordRunAnswer = useCallback(
    (wordId: string, grade: Grade) => setRun((prev) => (prev ? recordAnswer(prev, wordId, grade) : prev)),
    [setRun]
  );

  /** Marks a word as got right in the run — what makes it count as done. */
  const recordRunCleared = useCallback(
    (wordId: string) => setRun((prev) => (prev ? recordCleared(prev, wordId) : prev)),
    [setRun]
  );

  /** Writes one graded answer the moment it's given: the word's new ladder
   *  state, and a row in the practice log. Both persist on change, so a
   *  session abandoned half-way keeps everything answered up to that point. */
  const persistGrade = useCallback(({ word, grade }: ReviewedCard) => {
    setDeck((prev) =>
      prev.map((d) => (d.id === word.id ? { ...word, dateAdded: d.dateAdded } : d))
    );
    setResults((prev) => [...prev, { entryId: word.id, grade, timestamp: Date.now() }]);
  }, [setDeck, setResults]);

  /** Finishing a sitting ALWAYS lands on the result screen — it is the last
   *  step of the flow, and only the user leaving it returns them home. */
  function finishPractice() {
    setRoute("report");
  }

  // Recovery renders in place of the app, so it gets no navigation either —
  // the session is signed in, which would otherwise leave the tab bar showing
  // under a screen that isn't part of the app.
  // Onboarding has to wait for a signed-in user's remote habit (they may
  // have set it up on another device) — up to the grace period.
  const needsOnboarding = !locked && !recovering && habit === null;
  const waitingForHabit = needsOnboarding && !hydrated && !hydrationFailed && !graceOver;

  // Local data last synced with a different account is about to be replaced
  // by this one's (see useCloudSync) — not to be shown to them meanwhile.
  const owner = loadOwner();
  const foreignLocal = user !== null && !hydrated && owner !== null && owner !== user.id;

  const showTabs = !locked && !recovering && !needsOnboarding && !FOCUSED.includes(route);

  /** What stands in front of the app, if anything — in priority order. */
  function gate() {
    // The boot splash (main.tsx) covers this in practice — Supabase's
    // local-storage session read resolves well within its hold time.
    if (configured && !ready) return null;
    // A recovery link signs the user in, so this has to take precedence over
    // the normal signed-in app — otherwise the password they came to change
    // never gets changed.
    if (recovering) return <NewPassword onDone={clearRecovery} />;
    if (locked) {
      const openAuth = (mode: "signin" | "signup") => {
        setAuthMode(mode);
        setAuthStep("auth");
      };
      return authStep === "welcome" ? (
        <Welcome onCreateAccount={() => openAuth("signup")} onLogIn={() => openAuth("signin")} />
      ) : (
        <Auth initialMode={authMode} onBack={() => setAuthStep("welcome")} />
      );
    }
    if (waitingForHabit || foreignLocal) {
      return (
        <div className="screen center-col gutter" role="status">
          <p className="muted">Loading your words…</p>
        </div>
      );
    }
    if (needsOnboarding) {
      return (
        <Onboarding existingUser={deck.length > 0 || results.length > 0} onComplete={completeOnboarding} />
      );
    }
    return undefined;
  }
  const gated = gate();

  return (
    <div className="app-shell">
      <div className={showTabs ? "phone phone--tabs" : "phone"}>
        <div className="phone__content">
          {gated !== undefined ? (
            gated
          ) : (
            <>
              {route === "dashboard" && (
                <Dashboard
                  deckCount={deckEntries.length}
                  masteredCount={masteredCount}
                  today={todayProg}
                  inProgress={todayProg.towardGoal > 0}
                  week={week}
                  streak={streak}
                  cue={habit ? cueLine(habit) : ""}
                  tomorrow={habit ? `at ${habit.time}` : ""}
                  canExtra={canExtra}
                  onPractice={startPractice}
                  onExtra={startExtra}
                  onAddWord={openAdd}
                  onOpenWeek={() => setRoute("week")}
                />
              )}

              {route === "week" && habit && (
                <WeeklyGoal
                  week={week}
                  habit={habit}
                  onBack={() => setRoute("dashboard")}
                  onEdit={() => setRoute("settings")}
                />
              )}

              {route === "browse" && (
                <Browse
                  entries={deckEntries}
                  levels={levels}
                  tricky={tricky}
                  deckIds={deckIds}
                  onRemove={removeWord}
                  onRestore={restoreWord}
                  onEdit={editDeckWord}
                  onSave={saveCapturedWord}
                />
              )}

              {route === "settings" && (
                <Settings
                  deckCount={deck.length}
                  configured={configured}
                  email={user?.email ?? null}
                  habit={habit}
                  onHabitChange={changeHabit}
                  onSignOut={handleSignOut}
                />
              )}

              {route === "practice" && (
                <Practice
                  key={sessionId}
                  queue={queue}
                  pool={deckEntries}
                  scheduling={sessionMode === "scheduled"}
                  alreadyGraded={practisedSet}
                  onAnswer={recordRunAnswer}
                  onCleared={recordRunCleared}
                  onGrade={persistGrade}
                  onFinish={finishPractice}
                  // Leaving part-way is not finishing: every answer given so
                  // far is already logged, so the card reports the goal as
                  // part-done and "Continue" picks up the words still needed.
                  onClose={() => setRoute("dashboard")}
                />
              )}

              {route === "report" && (
                <SessionReport
                  knownIds={progress.knownIds}
                  learningIds={progress.learningIds}
                  deck={deck}
                  kind={sittingKind}
                  today={todayProg}
                  week={week}
                  newToday={sittingKind === "warmup" ? [] : newToday}
                  tomorrow={habit ? `at ${habit.time}` : ""}
                  reflectionReady={reflection !== null && todayProg.done && sittingKind === "goal"}
                  canExtra={canExtra}
                  onReviewMissed={practiseLearningAgain}
                  onExtra={startExtra}
                  onReflection={() => setRoute("reflection")}
                  onDone={() => setRoute("dashboard")}
                />
              )}

              {route === "reflection" && reflection && (
                <Reflection reflection={reflection} onDone={finishReflection} />
              )}

              {/* The container transform belongs to whichever screen the +
                  button actually opens: the chooser. The
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
          <TabBar active={activeTab} onChange={(t) => setRoute(t)} onAddWord={openAdd} />
        )}

        {showTabs && showWelcomeBack && (
          <WelcomeBack
            words={Math.min(RETURN_WARMUP_WORDS, goal)}
            onStart={() => welcomeBack(true)}
            onDismiss={() => welcomeBack(false)}
          />
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./lib/types";
import { findEntry } from "./data/dictionary";
import { isInDeck, loadDeck, loadResults, newDeckItem, saveDeck, saveResults } from "./lib/storage";
import { recallCounts } from "./lib/confidence";
import {
  buildNextSession,
  buildRestudySession,
  buildSession,
  buildSessionReport,
  type ReviewedCard,
  type SessionReport as EngineSessionReport,
  type Word,
} from "./lib/learningEngine";
import { Dashboard } from "./screens/Dashboard";
import { Browse } from "./screens/Browse";
import { Practice, type PracticeCard } from "./screens/Practice";
import { SessionReport } from "./screens/SessionReport";
import { Settings } from "./screens/Settings";
import { TabBar, type Tab } from "./components/TabBar";

type Route = Tab | "practice" | "report";

const FOCUSED: Route[] = ["practice", "report"];

/** Joins spaced-repetition Words back to their dictionary content for display. */
function toPracticeCards(words: Word[]): PracticeCard[] {
  return words
    .map((word) => {
      const entry = findEntry(word.id);
      return entry ? { entry, word } : null;
    })
    .filter((c): c is PracticeCard => c !== null);
}

export default function App() {
  const [deck, setDeck] = useState<DeckItem[]>(() => loadDeck());
  const [results, setResults] = useState<PracticeResult[]>(() => loadResults());
  const [route, setRoute] = useState<Route>("dashboard");

  const [queue, setQueue] = useState<PracticeCard[]>([]);
  const [report, setReport] = useState<EngineSessionReport | null>(null);
  // Word ids already covered earlier in the current study run (initial batch +
  // any restudy/next-batch continuations), so buildNextSession doesn't repeat them.
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);

  useEffect(() => saveDeck(deck), [deck]);
  useEffect(() => saveResults(results), [results]);

  // Resolve the deck (newest first) into full dictionary entries.
  const deckEntries = useMemo(
    () => deck.map((d) => findEntry(d.id)).filter((e): e is DictionaryEntry => Boolean(e)),
    [deck]
  );
  const deckIds = useMemo(() => new Set(deck.map((d) => d.id)), [deck]);

  // Successful-recall tally per word, used for confidence bars + mastery gating.
  const recalls = useMemo(() => recallCounts(results), [results]);

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

  function startPractice() {
    const session = buildSession(deck, new Date());
    if (session.length === 0) return;
    setQueue(toPracticeCards(session));
    setReviewedIds([]);
    setRoute("practice");
  }

  function finishPractice(reviewedCards: ReviewedCard[]) {
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

  function restudy() {
    if (!report) return;
    const words = buildRestudySession(report);
    if (words.length === 0) return;
    setQueue(toPracticeCards(words));
    setRoute("practice");
  }

  function continueToNext() {
    const words = buildNextSession(deck, reviewedIds, new Date());
    if (words.length === 0) {
      setRoute("dashboard");
      return;
    }
    setQueue(toPracticeCards(words));
    setRoute("practice");
  }

  const showTabs = !FOCUSED.includes(route);

  return (
    <div className="app-shell">
      <div className="phone">
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {route === "dashboard" && (
            <Dashboard
              deck={deckEntries}
              onPractice={startPractice}
              onBrowse={() => setRoute("browse")}
            />
          )}

          {route === "browse" && (
            <Browse deckIds={deckIds} recalls={recalls} onToggle={toggleWord} />
          )}

          {route === "settings" && <Settings deckCount={deck.length} />}

          {route === "practice" && (
            <Practice queue={queue} onFinish={finishPractice} onClose={() => setRoute("dashboard")} />
          )}

          {route === "report" && report && (
            <SessionReport report={report} onRestudy={restudy} onContinue={continueToNext} />
          )}
        </div>

        {showTabs && <TabBar active={activeTab} onChange={(t) => setRoute(t)} />}
      </div>
    </div>
  );
}

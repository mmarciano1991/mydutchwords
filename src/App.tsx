import { useEffect, useMemo, useState } from "react";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./lib/types";
import { findEntry } from "./data/dictionary";
import { isInDeck, loadDeck, loadResults, saveDeck, saveResults } from "./lib/storage";
import { isMastered, recallCounts } from "./lib/confidence";
import { Dashboard } from "./screens/Dashboard";
import { Browse } from "./screens/Browse";
import { Practice } from "./screens/Practice";
import { PracticeSummary } from "./screens/PracticeSummary";
import { Settings } from "./screens/Settings";
import { TabBar, type Tab } from "./components/TabBar";

type Route = Tab | "practice" | "summary";

const FOCUSED: Route[] = ["practice", "summary"];

export default function App() {
  const [deck, setDeck] = useState<DeckItem[]>(() => loadDeck());
  const [results, setResults] = useState<PracticeResult[]>(() => loadResults());
  const [route, setRoute] = useState<Route>("dashboard");

  const [queue, setQueue] = useState<DictionaryEntry[]>([]);
  const [lastScore, setLastScore] = useState({ knew: 0, total: 0 });

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
        : [{ id: entryId, dateAdded: Date.now() }, ...prev]
    );
  }

  function startPractice() {
    // Mastered words (15+ successful recalls) are retired from practice.
    const due = deckEntries.filter((e) => !isMastered(recalls.get(e.id) ?? 0));
    if (due.length === 0) return;
    setQueue(due);
    setRoute("practice");
  }

  function finishPractice(sessionResults: PracticeResult[]) {
    setResults((prev) => [...prev, ...sessionResults]);
    setLastScore({
      knew: sessionResults.filter((r) => r.knew).length,
      total: sessionResults.length,
    });
    setRoute("summary");
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
            <Practice
              entries={queue}
              onFinish={finishPractice}
              onClose={() => setRoute("dashboard")}
            />
          )}

          {route === "summary" && (
            <PracticeSummary
              correct={lastScore.knew}
              total={lastScore.total}
              onAgain={startPractice}
              onHome={() => setRoute("dashboard")}
            />
          )}
        </div>

        {showTabs && <TabBar active={activeTab} onChange={(t) => setRoute(t)} />}
      </div>
    </div>
  );
}

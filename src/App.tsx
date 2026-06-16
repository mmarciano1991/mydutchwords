import { useEffect, useMemo, useState } from "react";
import type { PracticeResult, Word } from "./lib/types";
import {
  loadResults,
  loadWords,
  saveResults,
  saveWords,
} from "./lib/storage";
import { Dashboard } from "./screens/Dashboard";
import { AddWord } from "./screens/AddWord";
import { Dictionary } from "./screens/Dictionary";
import { Practice } from "./screens/Practice";
import { PracticeSummary } from "./screens/PracticeSummary";
import { Settings } from "./screens/Settings";
import { TabBar, type Tab } from "./components/TabBar";

type Route = Tab | "add" | "practice" | "summary";

const FOCUSED: Route[] = ["add", "practice", "summary"];

export default function App() {
  const [words, setWords] = useState<Word[]>(() => loadWords());
  const [results, setResults] = useState<PracticeResult[]>(() => loadResults());
  const [route, setRoute] = useState<Route>("dashboard");

  // Practice session: the queue and the score of the just-finished session.
  const [queue, setQueue] = useState<Word[]>([]);
  const [lastScore, setLastScore] = useState({ correct: 0, total: 0 });

  useEffect(() => saveWords(words), [words]);
  useEffect(() => saveResults(results), [results]);

  const activeTab: Tab = useMemo(() => {
    if (route === "words") return "words";
    if (route === "settings") return "settings";
    return "dashboard";
  }, [route]);

  function handleSave(word: Word) {
    setWords((prev) => [word, ...prev]);
    setRoute("words");
  }

  function startPractice() {
    if (words.length === 0) return;
    setQueue(words);
    setRoute("practice");
  }

  function finishPractice(sessionResults: PracticeResult[]) {
    setResults((prev) => [...prev, ...sessionResults]);
    setLastScore({
      correct: sessionResults.filter((r) => r.correct).length,
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
              words={words}
              onAdd={() => setRoute("add")}
              onPractice={startPractice}
              onOpenWords={() => setRoute("words")}
            />
          )}

          {route === "words" && (
            <Dictionary words={words} onAdd={() => setRoute("add")} />
          )}

          {route === "settings" && <Settings />}

          {route === "add" && (
            <AddWord
              words={words}
              onBack={() => setRoute("dashboard")}
              onSave={handleSave}
            />
          )}

          {route === "practice" && (
            <Practice
              words={queue}
              onFinish={finishPractice}
              onClose={() => setRoute("dashboard")}
            />
          )}

          {route === "summary" && (
            <PracticeSummary
              correct={lastScore.correct}
              total={lastScore.total}
              onAgain={startPractice}
              onHome={() => setRoute("dashboard")}
            />
          )}
        </div>

        {showTabs && (
          <TabBar
            active={activeTab}
            onChange={(t) => setRoute(t)}
          />
        )}
      </div>
    </div>
  );
}

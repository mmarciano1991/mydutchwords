import { useMemo, useRef, useState } from "react";
import type { PracticeResult, Word } from "../lib/types";
import { blankOut, isCorrect } from "../lib/blank";
import { CheckCircle, CrossCircle } from "../components/icons";

export function Practice({
  words,
  onFinish,
  onClose,
}: {
  words: Word[];
  onFinish: (results: PracticeResult[]) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const results = useRef<PracticeResult[]>([]);

  const total = words.length;
  const word = words[index];
  const blanked = useMemo(
    () => blankOut(word.exampleSentence, word.dutch),
    [word]
  );
  const correct = isCorrect(typed, word.dutch);

  function check() {
    if (checked || !typed.trim()) return;
    results.current.push({
      wordId: word.id,
      correct,
      timestamp: Date.now(),
    });
    setChecked(true);
  }

  function next() {
    if (index + 1 >= total) {
      onFinish(results.current);
      return;
    }
    setIndex(index + 1);
    setTyped("");
    setChecked(false);
  }

  const progress = ((index + (checked ? 1 : 0)) / total) * 100;

  return (
    <div className="screen pad-top">
      <div className="topbar">
        <button className="iconbtn" onClick={onClose} aria-label="Close practice" style={{ width: 34, height: 34, borderRadius: 11, fontSize: 17 }}>
          ×
        </button>
        <div className="progress">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
          {index + 1}/{total}
        </span>
      </div>

      <div className="screen__body gutter" style={{ padding: "18px 22px 8px" }}>
        <div className="eyebrow">Fill in the blank</div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
          <span className="muted" style={{ fontSize: 15.5 }}>
            means “<strong style={{ color: "var(--primary)" }}>{word.translation}</strong>”
          </span>
        </div>

        <div className="card" style={{ marginTop: 18, padding: "26px 22px", boxShadow: "var(--shadow-card)" }}>
          {blanked.found ? (
            <div className="sentence">
              {blanked.before}
              {checked ? (
                <span className={correct ? "blank blank--filled" : "blank blank--wrong"}>
                  {correct ? blanked.answer : typed.trim() || "—"}
                </span>
              ) : (
                <span className="blank" />
              )}
              {blanked.after}
            </div>
          ) : (
            <div className="sentence">
              What's the Dutch word for “{word.translation}”?
            </div>
          )}
        </div>

        {!checked ? (
          <input
            className="text-input"
            style={{ marginTop: 20 }}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") check();
            }}
            placeholder="Type the missing word"
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        ) : (
          <>
            <div
              className={`notice ${correct ? "notice--success" : "notice--error"}`}
              style={{ marginTop: 20 }}
            >
              {correct ? <CheckCircle /> : <CrossCircle />}
              <span>
                {correct ? "Goed zo! · Correct" : "Bijna — the answer was "}
                {!correct && <strong>{word.dutch}</strong>}
              </span>
            </div>
            {!correct && !blanked.found && (
              <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>
                {word.exampleSentence}
              </p>
            )}
          </>
        )}
      </div>

      <div className="gutter" style={{ padding: "10px 22px 32px" }}>
        {!checked ? (
          <button
            className={`btn ${typed.trim() ? "btn--primary" : "btn--disabled"}`}
            onClick={check}
            disabled={!typed.trim()}
          >
            Check answer
          </button>
        ) : (
          <button className="btn btn--primary" onClick={next}>
            {index + 1 >= total ? "See results" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}

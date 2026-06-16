import { useState } from "react";
import type { Lookup, Word } from "../lib/types";
import { lookupWord } from "../lib/anthropic";
import { findDuplicate } from "../lib/storage";
import { BackIcon, SaveIcon, SearchIcon } from "../components/icons";
import { WarnCircle } from "../components/icons";

const SUGGESTIONS = ["tentoonstelling", "gewoonte", "fiets"];

type Status = "idle" | "looking" | "found" | "duplicate";

export function AddWord({
  words,
  onBack,
  onSave,
}: {
  words: Word[];
  onBack: () => void;
  onSave: (word: Word) => void;
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [lookup, setLookup] = useState<Lookup | null>(null);

  const dutch = input.trim();

  function reset() {
    setStatus("idle");
    setLookup(null);
  }

  async function handleLookup() {
    if (!dutch || status === "looking") return;

    if (findDuplicate(words, dutch)) {
      setStatus("duplicate");
      setLookup(null);
      return;
    }

    setStatus("looking");
    const result = await lookupWord(dutch);
    setLookup(result);
    setStatus("found");
  }

  function handleSave() {
    if (status !== "found" || !lookup) return;
    onSave({
      id: crypto.randomUUID(),
      dutch,
      translation: lookup.translation,
      exampleSentence: lookup.example_sentence,
      dateAdded: Date.now(),
    });
  }

  function primary() {
    if (status === "found") {
      handleSave();
    } else {
      handleLookup();
    }
  }

  const buttonLabel =
    status === "looking"
      ? "Translating…"
      : status === "found"
        ? "Save to Woordkast"
        : "Translate";

  const buttonDisabled = !dutch || status === "looking" || status === "duplicate";

  return (
    <div className="screen pad-top">
      <div className="topbar" style={{ padding: "4px 18px 14px" }}>
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 21, fontWeight: 600, color: "var(--text-display)" }}>
          Add a word
        </span>
      </div>

      <div className="screen__body gutter" style={{ padding: "4px 22px 16px" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            primary();
          }}
        >
          <label
            className="field"
            style={status === "found" ? { borderColor: "var(--primary)" } : undefined}
          >
            <SearchIcon />
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (status !== "idle") reset();
              }}
              placeholder="Type a Dutch word…"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>
        </form>

        {status === "idle" && !dutch && (
          <div style={{ marginTop: 16 }}>
            <div className="faint" style={{ fontSize: 12.5, marginBottom: 9 }}>
              Try one you might read today
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    reset();
                  }}
                  style={{
                    border: "1px solid #CFD8E8",
                    background: "#fff",
                    color: "var(--primary)",
                    fontFamily: "var(--font-serif)",
                    fontSize: 15.5,
                    padding: "8px 14px",
                    borderRadius: 11,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === "duplicate" && (
          <div className="notice notice--error" style={{ marginTop: 18 }}>
            <WarnCircle />
            <span>You already have this word in Woordkast.</span>
          </div>
        )}

        {status === "found" && lookup && (
          <div className="card" style={{ marginTop: 18, padding: 22 }}>
            <div className="eyebrow">Translation</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 37, fontWeight: 600, color: "var(--text-display)", marginTop: 9, lineHeight: 1.02 }}>
              {dutch}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7 }}>
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <path d="M1 7h15M11 2l5 5-5 5" stroke="#9DB0CB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 19, color: "var(--primary)", fontWeight: 500 }}>
                {lookup.translation}
              </span>
            </div>
            <div className="divider" style={{ margin: "18px 0" }} />
            <div className="eyebrow" style={{ marginBottom: 7 }}>In context</div>
            <div className="quote" style={{ fontStyle: "italic" }}>
              {lookup.example_sentence}
            </div>
          </div>
        )}
      </div>

      <div className="gutter" style={{ padding: "12px 22px 32px", borderTop: "1px solid #EFEADF" }}>
        <button
          className={`btn ${buttonDisabled ? "btn--disabled" : "btn--primary"}`}
          onClick={primary}
          disabled={buttonDisabled}
        >
          <SaveIcon color={buttonDisabled ? "currentColor" : "#FBF8F1"} />
          {buttonLabel}
        </button>
        <p className="faint" style={{ textAlign: "center", fontSize: 12, margin: "10px 0 0" }}>
          {status === "found"
            ? "One tap to save — three taps total"
            : "Type or pick a word to translate"}
        </p>
      </div>
    </div>
  );
}

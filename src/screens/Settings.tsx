import { useState } from "react";
import { Wordmark } from "../components/brand";
import { loadApiKey, saveApiKey } from "../lib/storage";
import { hasApiKey } from "../lib/anthropic";

export function Settings() {
  const [key, setKey] = useState(loadApiKey());
  const [saved, setSaved] = useState(false);

  const envKey = Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY);
  const connected = hasApiKey();

  function save() {
    saveApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Settings</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        <div
          className={`notice ${connected ? "notice--success" : "notice--caution"}`}
          style={{ marginBottom: 18 }}
        >
          <span>
            {connected
              ? "Connected to Claude — words get real translations and example sentences."
              : "Offline mode — using the built-in starter dictionary. Add a key for live translations."}
          </span>
        </div>

        <div className="card card--warm" style={{ padding: 20 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600, color: "var(--text-display)" }}>
            Anthropic API key
          </div>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: "8px 0 16px" }}>
            Optional. Stored only on this device (localStorage). When set, new
            words are translated by Claude. {envKey && "An environment key is also configured."}
          </p>
          <input
            className="text-input"
            style={{ fontFamily: "var(--font-sans)", fontSize: 15 }}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            type="password"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className={`btn ${key.trim() ? "btn--primary" : "btn--disabled"}`}
            style={{ marginTop: 14 }}
            onClick={save}
            disabled={!key.trim()}
          >
            {saved ? "Saved" : "Save key"}
          </button>
          {key && (
            <button
              className="link-btn"
              style={{ display: "block", margin: "14px auto 0" }}
              onClick={() => {
                setKey("");
                saveApiKey("");
              }}
            >
              Clear key
            </button>
          )}
        </div>

        <p className="faint" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 18, textAlign: "center" }}>
          Woordkast · Dutch words, kept like fine china.
        </p>
      </div>
    </div>
  );
}

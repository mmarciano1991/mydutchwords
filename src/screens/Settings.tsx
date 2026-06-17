import { useEffect, useState } from "react";
import { Wordmark } from "../components/brand";
import { checkBackend } from "../lib/anthropic";

type State = "checking" | "live" | "reachable-no-key" | "offline";

export function Settings() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    checkBackend().then(({ reachable, configured }) => {
      if (!active) return;
      setState(!reachable ? "offline" : configured ? "live" : "reachable-no-key");
    });
    return () => {
      active = false;
    };
  }, []);

  const status = {
    checking: { cls: "notice--caution", text: "Checking the AI backend…" },
    live: {
      cls: "notice--success",
      text: "Connected to Claude — words and exercises are generated live.",
    },
    "reachable-no-key": {
      cls: "notice--caution",
      text: "Backend reached, but no API key is configured yet. Using the offline starter dictionary.",
    },
    offline: {
      cls: "notice--caution",
      text: "Offline mode — using the built-in starter dictionary. Live AI activates once the server proxy is set up.",
    },
  }[state];

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Settings</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        <div className={`notice ${status.cls}`} style={{ marginBottom: 18 }}>
          <span>{status.text}</span>
        </div>

        <div className="card card--warm" style={{ padding: 20 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600, color: "var(--text-display)" }}>
            How translations work
          </div>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: "8px 0 0" }}>
            Woordkast looks up any Dutch word with Claude — translation, <em>de/het</em>,
            and a natural example sentence — and generates a fresh sentence for each
            practice question. The API key lives on the server (never in your browser),
            so nothing sensitive is exposed here.
          </p>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: "12px 0 0" }}>
            Until the key is configured, the app runs on a small offline dictionary so
            you can still try the full flow.
          </p>
        </div>

        <p className="faint" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 18, textAlign: "center" }}>
          Woordkast · Dutch words, kept like fine china.
        </p>
      </div>
    </div>
  );
}

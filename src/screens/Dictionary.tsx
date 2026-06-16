import { useState } from "react";
import type { Word } from "../lib/types";
import { Wordmark } from "../components/brand";
import { PlusIcon } from "../components/icons";

export function Dictionary({
  words,
  onAdd,
}: {
  words: Word[];
  onAdd: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Your words</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        {words.length === 0 ? (
          <div className="center-col" style={{ padding: "60px 20px" }}>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
              No words yet. Capture one you read today.
            </p>
          </div>
        ) : (
          <>
            <div className="spread" style={{ alignItems: "baseline", margin: "2px 2px 13px" }}>
              <span className="faint" style={{ fontSize: 12.5 }}>
                {words.length} word{words.length === 1 ? "" : "s"}
              </span>
              <span className="faint" style={{ fontSize: 12.5 }}>Newest first</span>
            </div>

            <div className="wordlist">
              {words.map((w) => {
                const open = openId === w.id;
                return (
                  <div key={w.id}>
                    <button
                      className="wordrow"
                      onClick={() => setOpenId(open ? null : w.id)}
                      aria-expanded={open}
                    >
                      <span className="dot" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="wordrow__dutch">{w.dutch}</div>
                        <div className="wordrow__gloss">{w.translation}</div>
                      </div>
                    </button>

                    {open && (
                      <div
                        className="card"
                        style={{ marginTop: 8, padding: "16px 18px", borderRadius: 16 }}
                      >
                        <div className="eyebrow" style={{ marginBottom: 7 }}>In context</div>
                        <div className="quote">{w.exampleSentence}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <button className="fab" onClick={onAdd} aria-label="Add a new word">
        <PlusIcon size={26} color="#fff" />
      </button>
    </div>
  );
}

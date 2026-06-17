import { useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { Wordmark } from "../components/brand";
import { GenderChip } from "../components/GenderChip";
import { PlusIcon } from "../components/icons";

export function Deck({
  entries,
  onRemove,
  onBrowse,
}: {
  entries: DictionaryEntry[];
  onRemove: (entryId: string) => void;
  onBrowse: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Your words</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        {entries.length === 0 ? (
          <div className="center-col" style={{ padding: "50px 20px" }}>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
              Your deck is empty. Open the dictionary and tap + to add the words
              you want to practise.
            </p>
            <button className="btn btn--secondary" style={{ marginTop: 18, width: "auto", padding: "12px 20px" }} onClick={onBrowse}>
              Browse the dictionary
            </button>
          </div>
        ) : (
          <>
            <div className="spread" style={{ alignItems: "baseline", margin: "2px 2px 13px" }}>
              <span className="faint" style={{ fontSize: 12.5 }}>
                {entries.length} word{entries.length === 1 ? "" : "s"}
              </span>
              <span className="faint" style={{ fontSize: 12.5 }}>Newest first</span>
            </div>

            <div className="wordlist">
              {entries.map((e) => {
                const open = openId === e.id;
                return (
                  <div key={e.id}>
                    <div className="wordrow" style={{ gap: 11 }}>
                      <button
                        onClick={() => setOpenId(open ? null : e.id)}
                        aria-expanded={open}
                        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 13, background: "none", border: "none", textAlign: "left", padding: 0 }}
                      >
                        <span className="dot" />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="wordrow__dutch" style={{ display: "block" }}>{e.dutch}</span>
                          <span className="wordrow__gloss" style={{ display: "block" }}>{e.english}</span>
                        </span>
                        <GenderChip gender={e.gender} size="sm" />
                      </button>
                      <button
                        className="addbtn addbtn--remove"
                        onClick={() => onRemove(e.id)}
                        aria-label={`Remove ${e.dutch}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="#B5462F" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>

                    {open && (
                      <div className="card" style={{ marginTop: 8, padding: "14px 18px", borderRadius: 16 }}>
                        <div className="eyebrow" style={{ marginBottom: 7 }}>In context</div>
                        <div className="quote">{e.example}</div>
                        <div className="faint" style={{ fontSize: 13, marginTop: 5 }}>{e.exampleEn}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <button className="fab" onClick={onBrowse} aria-label="Browse the dictionary">
        <PlusIcon size={26} color="#fff" />
      </button>
    </div>
  );
}

import { Wordmark } from "../components/brand";
import { DICTIONARY } from "../data/dictionary";

export function Settings({ deckCount }: { deckCount: number }) {
  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>About</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        <div className="card card--warm" style={{ padding: 20 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600, color: "var(--text-display)" }}>
            Fully offline
          </div>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: "8px 0 0" }}>
            Woordkast ships with a built-in Dutch dictionary of {DICTIONARY.length} words —
            each with its English meaning, <em>de/het</em> gender, and an example
            sentence. Everything runs on your device; there's no account, no
            internet needed, and nothing to pay for.
          </p>
        </div>

        <div className="card card--warm" style={{ padding: 20, marginTop: 14 }}>
          <div className="spread">
            <span className="muted" style={{ fontSize: 14 }}>Words in the dictionary</span>
            <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-display)" }}>{DICTIONARY.length}</span>
          </div>
          <div className="divider" style={{ margin: "12px 0" }} />
          <div className="spread">
            <span className="muted" style={{ fontSize: 14 }}>Words in your deck</span>
            <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-display)" }}>{deckCount}</span>
          </div>
        </div>

        <p className="faint" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 18, textAlign: "center" }}>
          Woordkast · Dutch words, kept like fine china.
        </p>
      </div>
    </div>
  );
}

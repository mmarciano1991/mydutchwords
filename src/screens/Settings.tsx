import { Wordmark } from "../components/brand";
import { DICTIONARY } from "../data/dictionary";

export function Settings({
  deckCount,
  configured,
  email,
  onSignIn,
  onSignOut,
}: {
  deckCount: number;
  /** Whether cloud sync (Supabase) is configured for this build. */
  configured: boolean;
  /** The signed-in user's email, or null when logged out. */
  email: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="screen pad-top">
      <div className="gutter" style={{ padding: "4px 22px 14px" }}>
        <Wordmark />
        <h1 className="title-serif" style={{ marginTop: 7 }}>Settings</h1>
      </div>

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
        {/* Account — only shown when cloud sync is set up for this build. */}
        {configured && (
          <div className="card card--warm" style={{ padding: 20, marginBottom: 14 }}>
            {email ? (
              <>
                <div className="account-row">
                  <span className="account-avatar">{email[0]?.toUpperCase() ?? "?"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {email}
                    </div>
                    <div className="faint" style={{ fontSize: 12.5 }}>Progress syncs to your profile</div>
                  </div>
                </div>
                <button className="btn btn--secondary" style={{ marginTop: 16 }} onClick={onSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600, color: "var(--text-display)" }}>
                  Save your progress
                </div>
                <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: "8px 0 0" }}>
                  Create a profile to keep your deck and progress backed up and synced across
                  devices. Optional — the app works fully offline without one.
                </p>
                <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={onSignIn}>
                  Sign in or create account
                </button>
              </>
            )}
          </div>
        )}

        <div className="card card--warm" style={{ padding: 20 }}>
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

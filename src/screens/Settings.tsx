import { useEffect, useState } from "react";
import { Appbar } from "../components/Appbar";
import { CommitmentIcon } from "../components/CommitmentIcon";
import {
  COMMITMENTS,
  WEEKLY_TARGET_OPTIONS,
  isHabitTime,
  type Commitment,
  type HabitState,
} from "../lib/habit";
import { notificationsSupported, requestReminderPermission } from "../lib/reminders";
import { setSoundEffectsMuted, soundEffectsMuted } from "../lib/sfx";
import { Notice } from "../components/Notice";
import { readDevMode, writeDevMode } from "../lib/devMode";
import { backupFileName, createBackup, parseBackup, restoreBackup } from "../lib/durableStore";

export type HabitPrefs = Pick<HabitState, "commitment" | "time" | "weeklyTarget" | "reminders" | "audioExercises">;

export function Settings({
  deckCount,
  configured,
  email,
  habit,
  dutchAudio = false,
  isAdmin = false,
  onHabitChange,
  onSignOut,
  onDeleteAccount,
  researchConsent = false,
  onResearchConsentChange,
  onOpenAbout,
  onPreviewOnboarding,
}: {
  deckCount: number;
  /** Whether cloud sync (Supabase) is configured for this build. */
  configured: boolean;
  /** The signed-in user's email — Settings is only reachable while signed
   *  in (App.tsx gates everything else behind Auth), so this is always
   *  set whenever `configured` is true. */
  email: string | null;
  habit: HabitState | null;
  /** This device can speak Dutch (see lib/audio). */
  dutchAudio?: boolean;
  /** Changes a preference. History (done days, the week) is untouched. */
  onHabitChange: (prefs: Partial<HabitPrefs>) => void;
  /** Resolves false, without signing out, when the latest progress couldn't
   *  be saved first — unless `force`d. */
  onSignOut: (opts?: { force?: boolean }) => Promise<boolean>;
  /** Deletes the account and everything stored for it. Resolves an error
   *  message, or null once it is gone. */
  onDeleteAccount?: () => Promise<string | null>;
  /** The learner opted in to the field study's review log (lib/research). */
  researchConsent?: boolean;
  onResearchConsentChange?: (on: boolean) => Promise<string | null>;
  /** Opens About & licences. */
  onOpenAbout?: () => void;
  /** The account is an admin (Supabase app_metadata.role = "admin"):
   *  shows the Developer card. */
  isAdmin?: boolean;
  /** Dev tool: walk through onboarding again as a preview — nothing saved. */
  onPreviewOnboarding?: (as: "new" | "existing") => void;
}) {
  const [devMode, setDevMode] = useState(readDevMode);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  // Per device, not part of the synced habit: sound is about where you are.
  const [sfxOn, setSfxOn] = useState(() => !soundEffectsMuted());
  // What the time field shows, which may briefly be half-typed (""). Bound
  // to the saved time directly, a half-typed value was rejected and the
  // field snapped straight back, so the time couldn't be typed over.
  const [timeInput, setTimeInput] = useState(habit?.time ?? "");
  const savedTime = habit?.time;
  useEffect(() => {
    // Follows a change made elsewhere (another device, via sync).
    if (savedTime) setTimeInput((shown) => (isHabitTime(shown) || shown === "" ? savedTime : shown));
  }, [savedTime]);
  const [signOut, setSignOut] = useState<"idle" | "saving" | "unsaved">("idle");
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "busy">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ReturnType<typeof createBackup> | null>(null);

  async function deleteForGood() {
    if (!onDeleteAccount) return;
    setDeleting("busy");
    setDeleteError(null);
    const error = await onDeleteAccount();
    if (error) {
      setDeleteError(error);
      setDeleting("confirm");
    }
    // On success App leaves Settings for the Welcome screen.
  }

  async function toggleConsent(on: boolean) {
    if (!onResearchConsentChange) return;
    setConsentBusy(true);
    setConsentError(null);
    const error = await onResearchConsentChange(on);
    setConsentBusy(false);
    if (error) setConsentError(error);
  }

  function saveBackup() {
    const blob = new Blob([JSON.stringify(createBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupNote({ type: "success", text: "Backup saved. Keep the file somewhere safe." });
  }

  async function chooseBackup(file: File | undefined) {
    setBackupNote(null);
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (typeof parsed === "string") setBackupNote({ type: "error", text: parsed });
    else setPendingRestore(parsed);
  }

  function confirmRestore() {
    if (!pendingRestore) return;
    restoreBackup(pendingRestore);
    // The app reads its state at start-up; with an account, sync then
    // merges the restored words with the account's.
    window.location.reload();
  }

  async function logOut(force = false) {
    setSignOut("saving");
    const done = await onSignOut({ force });
    if (!done) setSignOut("unsaved");
  }

  async function toggleReminders(on: boolean) {
    setReminderNote(null);
    if (!on) {
      onHabitChange({ reminders: false });
      return;
    }
    const granted = await requestReminderPermission();
    if (granted) onHabitChange({ reminders: true });
    else setReminderNote("Notifications are blocked for this site — allow them in your browser settings.");
  }

  return (
    <div className="screen">
      <Appbar title="Settings" />

      <div className="screen__body gutter settings-body">
        {habit && (
          <div className="card card--warm settings-habit">
            <p className="settings-habit__heading">Your daily Dutch</p>

            <p className="settings-habit__label" id="set-commitment">How much fits your day</p>
            <div className="seg" role="radiogroup" aria-labelledby="set-commitment">
              {COMMITMENTS.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={habit.commitment === c.id}
                  className={`seg__opt${habit.commitment === c.id ? " is-selected" : ""}`}
                  onClick={() => onHabitChange({ commitment: c.id as Commitment })}
                >
                  <CommitmentIcon commitment={c.id} size={22} />
                  {c.name}
                  <span className="seg__sub">{c.words} words</span>
                </button>
              ))}
            </div>

            <label className="settings-habit__label" htmlFor="set-time">When you do it</label>
            {/* A half-typed time reads as "" — ignored, so the saved time
                only changes once the field holds a whole one. */}
            <input
              id="set-time"
              type="time"
              className="time-field"
              value={timeInput}
              onChange={(e) => {
                setTimeInput(e.target.value);
                if (isHabitTime(e.target.value)) onHabitChange({ time: e.target.value });
              }}
              onBlur={() => !isHabitTime(timeInput) && habit.time && setTimeInput(habit.time)}
            />

            <p className="settings-habit__label" id="set-week">Days a week</p>
            <div className="seg seg--row" role="radiogroup" aria-labelledby="set-week">
              {WEEKLY_TARGET_OPTIONS.map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={habit.weeklyTarget === n}
                  className={`seg__opt seg__opt--num${habit.weeklyTarget === n ? " is-selected" : ""}`}
                  onClick={() => onHabitChange({ weeklyTarget: n })}
                >
                  {n}
                </button>
              ))}
            </div>

            {notificationsSupported() && (
              <>
                <div className="divider settings-habit__divider" />
                <label className="toggle-row">
                  <span>
                    <span className="toggle-row__title">Gentle reminder</span>
                    <span className="toggle-row__sub">
                      Once, at {habit.time} — skipped if today is done.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={habit.reminders}
                    onChange={(e) => void toggleReminders(e.target.checked)}
                  />
                </label>
                {reminderNote && <p className="settings-habit__note">{reminderNote}</p>}
              </>
            )}

            <div className="divider" style={{ margin: "16px 0 14px" }} />
            <label className="toggle-row">
              <span>
                <span className="toggle-row__title">Audio exercises</span>
                <span className="toggle-row__sub">
                  {dutchAudio
                    ? "Listening exercises play the Dutch word aloud."
                    : "This device has no Dutch voice, so there are no listening exercises yet."}
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle"
                checked={habit.audioExercises}
                onChange={(e) => onHabitChange({ audioExercises: e.target.checked })}
              />
            </label>

            <div className="divider" style={{ margin: "16px 0 14px" }} />
            <label className="toggle-row">
              <span>
                <span className="toggle-row__title">Sound effects</span>
                <span className="toggle-row__sub">
                  A chime for right and wrong answers. Spoken Dutch words still play.
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle"
                checked={sfxOn}
                onChange={(e) => {
                  setSfxOn(e.target.checked);
                  setSoundEffectsMuted(!e.target.checked);
                }}
              />
            </label>

            <p className="settings-habit__foot">
              Changing these never resets your progress or your week.
            </p>
          </div>
        )}

        {/* Account — only shown when cloud sync is set up for this build. */}
        {configured && (
          <div className="card card--warm settings-card settings-card--account">
            <div className="account-row">
              <span className="account-avatar">{email?.[0]?.toUpperCase() ?? "?"}</span>
              <div className="account-row__text">
                <div className="account-row__email">
                  {email}
                </div>
                <div className="faint account-row__sub">Progress syncs to your account</div>
              </div>
            </div>
            {signOut === "unsaved" ? (
              <div className="settings-signout">
                <Notice type="caution">
                  Your latest progress couldn’t be saved — check your connection. Logging out now would lose it.
                </Notice>
                <button className="btn btn--secondary" onClick={() => void logOut()}>
                  Try again
                </button>
                <button className="link-btn" onClick={() => void logOut(true)}>
                  Log out anyway
                </button>
              </div>
            ) : (
              <button
                className="btn btn--secondary settings-signout__btn"
                onClick={() => void logOut()}
                disabled={signOut === "saving"}
              >
                {signOut === "saving" ? "Saving…" : "Log out"}
              </button>
            )}

            {onDeleteAccount && (
              <div className="settings-delete">
                {deleting === "idle" ? (
                  <button className="link-btn settings-delete__link" onClick={() => setDeleting("confirm")}>
                    Delete account
                  </button>
                ) : (
                  <div className="settings-delete__confirm" role="group" aria-labelledby="delete-heading">
                    <p className="settings-habit__heading" id="delete-heading">Delete your account?</p>
                    <Notice type="caution">
                      Your account, deck, progress and practice history are deleted from our servers and
                      from this device. This can&rsquo;t be undone. Save a backup first if you might want
                      your words back.
                    </Notice>
                    {deleteError && <Notice type="error">{deleteError}</Notice>}
                    <button
                      className="btn btn--danger"
                      onClick={() => void deleteForGood()}
                      disabled={deleting === "busy"}
                    >
                      {deleting === "busy" ? "Deleting…" : "Delete my account"}
                    </button>
                    <button
                      className="link-btn link-btn--center"
                      onClick={() => {
                        setDeleting("idle");
                        setDeleteError(null);
                      }}
                      disabled={deleting === "busy"}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {configured && onResearchConsentChange && (
          <div className="card card--warm settings-card settings-research">
            <label className="toggle-row">
              <span>
                <span className="toggle-row__title">Help research</span>
                <span className="toggle-row__sub">
                  Share each answer you give — the word, right or wrong, and how long it took — with the
                  Woordkast study on how people learn words. Off by default; turning it off stops it at
                  once. See the privacy policy.
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle"
                checked={researchConsent}
                disabled={consentBusy}
                onChange={(e) => void toggleConsent(e.target.checked)}
              />
            </label>
            {consentError && <p className="settings-habit__note">{consentError}</p>}
          </div>
        )}

        <div className="card card--warm settings-card">
          <div className="spread">
            <span className="muted settings-stat__label">Words in your deck</span>
            <span className="settings-stat__value">{deckCount}</span>
          </div>
        </div>

        <div className="card card--warm settings-card settings-backup">
          <p className="settings-habit__heading">Backup</p>
          <p className="toggle-row__sub">
            {configured
              ? "Your progress syncs to your account. A backup file is an extra copy you keep yourself."
              : "Your progress is kept on this device only. Save a backup now and then, so clearing the browser can’t lose it."}
          </p>
          {pendingRestore ? (
            <div className="settings-backup__confirm">
              <Notice type="caution">
                Restore the backup from {new Date(pendingRestore.exportedAt).toLocaleDateString()}? It
                replaces the words and progress on this device
                {configured ? ", then syncs them with your account (nothing in your account is lost)" : ""}.
              </Notice>
              <button className="btn btn--primary" onClick={confirmRestore}>
                Restore
              </button>
              <button className="link-btn link-btn--center" onClick={() => setPendingRestore(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="settings-backup__actions">
              <button className="btn btn--secondary" onClick={saveBackup}>
                Save a backup
              </button>
              <label className="btn btn--secondary settings-backup__load">
                Restore from a backup
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    void chooseBackup(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
          {backupNote && <Notice type={backupNote.type}>{backupNote.text}</Notice>}
        </div>

        <div className="card card--warm settings-card settings-links">
          <a className="settings-link" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener">
            Privacy policy
          </a>
          {onOpenAbout && (
            <button className="settings-link" onClick={onOpenAbout}>
              About &amp; licences
            </button>
          )}
        </div>

        {/* Developer — admins only. Dev mode is a per-device switch; its
            tools preview flows without touching the account's data. */}
        {isAdmin && (
          <div className="card card--warm settings-card">
            <p className="settings-habit__heading">Developer</p>
            <label className="toggle-row">
              <span>
                <span className="toggle-row__title">Dev mode</span>
                <span className="toggle-row__sub">Tools for testing flows on this device.</span>
              </span>
              <input
                type="checkbox"
                className="toggle"
                checked={devMode}
                onChange={(e) => {
                  setDevMode(e.target.checked);
                  writeDevMode(e.target.checked);
                }}
              />
            </label>
            {devMode && onPreviewOnboarding && (
              <div className="settings-dev">
                <button className="btn btn--secondary" onClick={() => onPreviewOnboarding("new")}>
                  Preview onboarding · new user
                </button>
                <button className="btn btn--secondary" onClick={() => onPreviewOnboarding("existing")}>
                  Preview onboarding · existing user
                </button>
                <p className="settings-habit__foot">
                  A preview only: your words, progress and settings stay exactly as they are.
                </p>
              </div>
            )}
          </div>
        )}

        <p className="faint settings-foot">
          Woordkast · Dutch words, kept like fine china.
        </p>
      </div>
    </div>
  );
}

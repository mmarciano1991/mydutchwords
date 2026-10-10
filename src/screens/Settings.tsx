import { useEffect, useState } from "react";
import { Appbar } from "../components/Appbar";
import { CommitmentIcon } from "../components/CommitmentIcon";
import { DICTIONARY } from "../data/dictionary";
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
          </div>
        )}

        <div className="card card--warm settings-card">
          <div className="spread">
            <span className="muted settings-stat__label">Words in the dictionary</span>
            <span className="settings-stat__value">{DICTIONARY.length}</span>
          </div>
          <div className="divider settings-stat__divider" />
          <div className="spread">
            <span className="muted settings-stat__label">Words in your deck</span>
            <span className="settings-stat__value">{deckCount}</span>
          </div>
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

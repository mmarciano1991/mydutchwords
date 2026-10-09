import { useState } from "react";
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

export type HabitPrefs = Pick<HabitState, "commitment" | "time" | "weeklyTarget" | "reminders" | "audioExercises">;

export function Settings({
  deckCount,
  configured,
  email,
  habit,
  dutchAudio = false,
  onHabitChange,
  onSignOut,
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
  onSignOut: () => void;
}) {
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  // Per device, not part of the synced habit: sound is about where you are.
  const [sfxOn, setSfxOn] = useState(() => !soundEffectsMuted());

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

      <div className="screen__body gutter" style={{ paddingBottom: 26 }}>
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
              value={habit.time}
              onChange={(e) => isHabitTime(e.target.value) && onHabitChange({ time: e.target.value })}
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
                <div className="divider" style={{ margin: "16px 0 14px" }} />
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
          <div className="card card--warm" style={{ padding: 20, marginBottom: 14 }}>
            <div className="account-row">
              <span className="account-avatar">{email?.[0]?.toUpperCase() ?? "?"}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {email}
                </div>
                <div className="faint" style={{ fontSize: 12.5 }}>Progress syncs to your account</div>
              </div>
            </div>
            <button className="btn btn--secondary" style={{ marginTop: 16 }} onClick={onSignOut}>
              Log out
            </button>
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

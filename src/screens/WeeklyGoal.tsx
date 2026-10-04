/* WeeklyGoal (Figma 359:1055) — opened from the dashboard's calendar
   counter. This week against the weekly target, a celebration once it's
   met, and the rhythm behind it (daily amount + days a week) with a way
   into Settings to change either.

   The week itself is WeekGoalStatus, shared with the session report. */
import { Appbar } from "../components/Appbar";
import { CommitmentIcon } from "../components/CommitmentIcon";
import { IconButton } from "../components/IconButton";
import { WeekGoalStatus } from "../components/WeekGoalStatus";
import { CheckCircle, Event } from "../icons";
import { commitmentOf, type HabitState, type WeekProgress } from "../lib/habit";

export function WeeklyGoal({
  week,
  habit,
  onBack,
  onEdit,
}: {
  week: WeekProgress;
  habit: HabitState;
  onBack: () => void;
  /** Opens Settings, where the commitment and target are changed. */
  onEdit: () => void;
}) {
  const reached = week.done >= week.target;
  const c = commitmentOf(habit.commitment);

  return (
    <div className="screen">
      <Appbar title="Weekly goal" onBack={onBack} onEdit={onEdit} />

      <div className="screen__body weekgoal">
        <WeekGoalStatus week={week} />

        {reached && (
          <section className="weekgoal__celebration">
            <CheckCircle size={32} aria-hidden="true" />
            <div className="weekgoal__text">
              <p className="weekgoal__celebration-title">Goal reached!</p>
              <p className="weekgoal__celebration-body">
                You kept your Dutch going {week.done} day{week.done === 1 ? "" : "s"} this week.
              </p>
            </div>
          </section>
        )}

        <section className="weekgoal__rhythm">
          <div className="weekgoal__rhythm-head">
            <h2 className="weekgoal__rhythm-title">Your rhythm</h2>
            <IconButton action="edit" onClick={onEdit} aria-label="Change your rhythm" />
          </div>
          <div className="weekgoal__row">
            <span className="weekgoal__icon" aria-hidden="true">
              <CommitmentIcon commitment={c.id} size={20} />
            </span>
            <div className="weekgoal__text">
              <p className="weekgoal__row-title">
                {c.name} · {c.words} words a day
              </p>
              <p className="weekgoal__row-sub">
                About {c.minutes} minutes, at {habit.time}
              </p>
            </div>
          </div>
          <div className="weekgoal__divider" aria-hidden="true" />
          <div className="weekgoal__row">
            <span className="weekgoal__icon" aria-hidden="true">
              <Event size={20} />
            </span>
            <div className="weekgoal__text">
              <p className="weekgoal__row-title">
                {week.target} day{week.target === 1 ? "" : "s"} a week
              </p>
              <p className="weekgoal__row-sub">
                {week.target < 7 ? "Leaves room for busy days" : "A little Dutch every day"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

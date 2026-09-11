/* Insights — the dashboard's header block (Figma 317:1416): a streak strip,
   and beneath it the deck total and the mastery bar, both on porcelain.

   The two sit flush so they read as one masthead running off both edges of
   the screen — square on every corner, with a warm hairline under each piece
   doing the separating. Everything it shows is derived from the synced deck
   + practice log, so it needs no state of its own. */
import { ModeHeat } from "../icons";
import { ProgressBar } from "./ProgressBar";

export function Insights({
  deckCount,
  masteredCount,
  streak,
}: {
  /** Words saved in the deck. */
  deckCount: number;
  /** Of those, how many have reached the top of the ladder. */
  masteredCount: number;
  /** Consecutive practice days. 0 turns the strip into an invitation. */
  streak: number;
}) {
  return (
    <section className="insights">
      <div className="insights__topbar">
        <ModeHeat className="insights__flame" />
        <p className="insights__streak">
          {streak > 0
            ? `${streak}-day streak — goed bezig!`
            : "Practise today to start a streak"}
        </p>
      </div>

      <div className="insights__hero">
        <div className="insights__top">
          <p className="insights__eyebrow">Your progress</p>
          <p className="insights__stat">
            {deckCount} word{deckCount === 1 ? "" : "s"} in your deck
          </p>
        </div>
        <ProgressBar
          value={masteredCount}
          max={deckCount}
          label={`${masteredCount} mastered so far`}
        />
      </div>
    </section>
  );
}

/* MasteryStatus — a deck word's learning status (Figma "learning" 465:4895,
   used on dictionary_card 465:4956): a 16px progress ring and its label —
   New · Learning · Mastering · Mastered. The label carries the meaning; the
   ring's colour is a second cue, never the only one.

   The status is read straight off the learning engine's state (masteryOf):
   nothing here keeps or computes progress of its own. */
import type { Word } from "../lib/learningEngine";

export type Mastery = "New" | "Learning" | "Mastering" | "Mastered";

export function masteryOf(word: Pick<Word, "state" | "evidenceTier">): Mastery {
  if (word.state === "new") return "New";
  if (word.state === "learned") return "Mastered";
  return word.evidenceTier >= 2 ? "Mastering" : "Learning";
}

// Ring and arc from the Figma "graph" icon; colours come from the stylesheet.
const RING =
  "M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM4.8 8C4.8 9.76731 6.23269 11.2 8 11.2C9.76731 11.2 11.2 9.76731 11.2 8C11.2 6.23269 9.76731 4.8 8 4.8C6.23269 4.8 4.8 6.23269 4.8 8Z";
const ARC =
  "M8 0C9.5377 1.83368e-08 11.0428 0.443161 12.3352 1.27643C13.6275 2.1097 14.6523 3.29777 15.2869 4.6984L10.9148 6.67936C10.6609 6.11911 10.251 5.64388 9.73406 5.31057C9.21712 4.97726 8.61508 4.8 8 4.8L8 0Z";
const CHECK = "M6.36667 12L2.56667 8.2L3.51667 7.25L6.36667 10.1L12.4833 3.98333L13.4333 4.93333L6.36667 12Z";

function Ring({ mastery }: { mastery: Mastery }) {
  return (
    <svg className="mastery-status__ring" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {mastery === "Mastered" ? (
        <>
          <circle className="mastery-status__disc" cx="8" cy="8" r="8" />
          <path className="mastery-status__check" d={CHECK} />
        </>
      ) : (
        <>
          <path className="mastery-status__track" d={RING} fillRule="evenodd" />
          <path className="mastery-status__arc" d={ARC} />
        </>
      )}
    </svg>
  );
}

export function MasteryStatus({ mastery }: { mastery: Mastery }) {
  return (
    <span className={`mastery-status mastery-status--${mastery.toLowerCase()}`}>
      <Ring mastery={mastery} />
      {mastery}
    </span>
  );
}

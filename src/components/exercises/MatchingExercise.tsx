/* MatchingExercise — 4–5 Dutch words and their translations, shuffled in
   two columns (Figma "Practice session": Matching → Select → Success / Error).

   Tap a word in either column, then one in the other: the pair is checked
   there and then, with no Check. A right pair flashes green and settles into
   its finished, muted state — disabled for the rest of the grid. A wrong pair
   flashes red, then both words go back to unselected, still free to pair.
   The tiles carry that feedback alone: the dock stays put until the last
   pair is made, when it shows "Correct" and Continue.

   Each word on the grid is graded here: correct only if its first pairing
   attempt was right. A wrong pair counts against the Dutch word in it.
   "I do not know" reveals the pairs still open and ends the grid.

   Pairs are judged by meaning, not by card: if two words on the grid share
   a translation, either one pairs with it. */
import { useEffect, useState } from "react";
import { matchingLabels, normalize, shuffle } from "../../lib/exercises";
import type { DictionaryEntry } from "../../lib/types";
import { Cancel, CheckCircle } from "../../icons";
import type { ExerciseCallbacks } from "./types";
import { AnswerPanel } from "./AnswerPanel";
import { speakDutch } from "../../lib/audio";
import { playSound, SOUND_MS } from "../../lib/sfx";
import { usePronunciation } from "./usePronunciation";

/** How long a checked pair shows its verdict before settling. */
export const MATCH_RIGHT_MS = 800;
export const MATCH_WRONG_MS = 1000;

type Side = "nl" | "en";
type Pair = { nl: string; en: number };
type Flash = { kind: "right" | "wrong"; pair: Pair };

export function MatchingExercise({
  entries,
  onResult,
  onNext,
  comesBack,
}: { entries: DictionaryEntry[] } & ExerciseCallbacks) {
  // Shuffled once per grid, so nothing moves under a finger.
  const [left] = useState(() => shuffle(entries));
  // Judged on the full translation; shown as one gloss, so a tile is one line.
  const [right] = useState(() => {
    const labels = matchingLabels(entries);
    return shuffle(entries.map((e, i) => ({ key: i, english: e.english, label: labels[i] })));
  });

  const [selected, setSelected] = useState<{ side: Side; key: string | number } | null>(null);
  const [matchedNl, setMatchedNl] = useState<Set<string>>(new Set());
  const [matchedEn, setMatchedEn] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  /** The pair just checked, while it shows its verdict. */
  const [flash, setFlash] = useState<Flash | null>(null);
  /** The grid is over: every pair made, or the rest revealed. */
  const [ended, setEnded] = useState<"complete" | "revealed" | null>(null);

  // A new flash restarts the clock; a tap clears it early.
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), flash.kind === "right" ? MATCH_RIGHT_MS : MATCH_WRONG_MS);
    return () => window.clearTimeout(t);
  }, [flash]);

  // Nothing said up front; a Dutch tile speaks when tapped.
  usePronunciation(null);

  const entryOf = (id: string) => entries.find((e) => e.id === id)!;
  const isMatched = (side: Side, key: string | number) =>
    side === "nl" ? matchedNl.has(key as string) : matchedEn.has(key as number);

  function check(pair: Pair) {
    setSelected(null);
    const entry = entryOf(pair.nl);
    if (normalize(entry.english) === normalize(right.find((r) => r.key === pair.en)!.english)) {
      const nowMatched = new Set(matchedNl).add(pair.nl);
      setMatchedNl(nowMatched);
      setMatchedEn((s) => new Set(s).add(pair.en));
      onResult(pair.nl, missed.has(pair.nl) ? "wrong" : "correct");
      // The pair's own sound: a late match is still a right one (the
      // result above is the grade, which remembers the miss).
      playSound("correct");
      setFlash({ kind: "right", pair });
      if (nowMatched.size === entries.length) setEnded("complete");
    } else {
      setMissed((s) => new Set(s).add(pair.nl));
      playSound("wrong");
      setFlash({ kind: "wrong", pair });
    }
  }

  function tap(side: Side, key: string | number) {
    if (ended || isMatched(side, key)) return;
    setFlash(null);
    const completes = selected !== null && selected.side !== side;
    // A tapped Dutch word is said — after the pair's sound, if it makes one.
    if (side === "nl" && selected?.key !== key) {
      speakDutch(entryOf(key as string).dutch, { delayMs: completes ? SOUND_MS.correct : 0 });
    }
    if (!completes) {
      setSelected(selected?.key === key ? null : { side, key });
      return;
    }
    check(side === "nl" ? { nl: key as string, en: selected.key as number } : { nl: selected.key as string, en: key as number });
  }

  function dontKnow() {
    if (ended) return;
    for (const e of entries) {
      if (!matchedNl.has(e.id)) onResult(e.id, missed.has(e.id) ? "wrong" : "dont_know");
    }
    setSelected(null);
    setFlash(null);
    setEnded("revealed");
  }

  function stateOf(side: Side, key: string | number): string {
    if (flash && (side === "nl" ? flash.pair.nl === key : flash.pair.en === key)) {
      return flash.kind === "right" ? " is-right" : " is-wrong";
    }
    if (isMatched(side, key)) return " is-matched";
    if (ended === "revealed") return " is-answer";
    if (selected?.side === side && selected.key === key) return " is-selected";
    return "";
  }

  function tile(side: Side, key: string | number, text: string) {
    const state = stateOf(side, key);
    return (
      <button
        key={key}
        type="button"
        lang={side}
        className={`answer-option match-option${state}`}
        aria-pressed={state === " is-selected"}
        disabled={ended !== null || isMatched(side, key)}
        onClick={() => tap(side, key)}
      >
        <span className="answer-option__label">{text}</span>
        {(state === " is-right" || state === " is-answer") && <CheckCircle size={24} aria-hidden="true" />}
        {state === " is-wrong" && <Cancel size={24} aria-hidden="true" />}
      </button>
    );
  }

  let panel;
  if (ended === "complete") {
    panel = (
      <AnswerPanel
        verdict="correct"
        message="Correct"
        note={missed.size > 0 ? comesBack : undefined}
        onContinue={() => onNext(missed.size === 0)}
      />
    );
  } else if (ended === "revealed") {
    panel = <AnswerPanel verdict="wrong" message="Here are the pairs" note={comesBack} onContinue={() => onNext(false)} />;
  } else {
    panel = <AnswerPanel verdict={null} canCheck={false} noCheck skipLabel="I do not know" onSkip={dontKnow} />;
  }

  return (
    <>
      <div className="screen__body gutter exercise exercise--matching">
        <div className="exercise__group">
          <p className="exercise__verdict">Tap a Dutch word, then its translation.</p>
          <div className="matching" role="group" aria-label="Match the pairs">
            <div className="matching__col">{left.map((e) => tile("nl", e.id, e.dutch))}</div>
            <div className="matching__col">
              {right.map((r) => tile("en", r.key, r.label))}
            </div>
          </div>
        </div>
      </div>
      {panel}
    </>
  );
}

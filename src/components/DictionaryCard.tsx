/* DictionaryCard — a sense in the deck (Figma dictionary_card 465:4994,
   variants "Defaul" and "Open").

   Learning status on top (MasteryStatus), then the word with its article
   and an arrow, the part-of-speech pill, and the gloss; the ⋮ menu (Edit,
   Delete) on the right. Word and arrow are one button, so both open and
   close the card through the same state, and aria-expanded follows it.
   Open, the card shows its context (the word in a sentence, or the edit
   form) under a divider. The ⋮ is a sibling button, never nested in it. */
import type { ReactNode } from "react";
import type { DictionaryEntry } from "../lib/types";
import { ChevronDown } from "../icons";
import { InfoPill, sensePills } from "./InfoPill";
import { MasteryStatus, type Mastery } from "./MasteryStatus";
import { MoreMenu } from "./MoreMenu";
import { PosPill } from "./PosPill";

export function DictionaryCard({
  entry,
  mastery,
  tricky = false,
  open,
  onToggle,
  onEdit,
  onDelete,
  children,
}: {
  entry: DictionaryEntry;
  mastery: Mastery;
  tricky?: boolean;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** The expanded part: the word in context, or the edit form. */
  children?: ReactNode;
}) {
  const s = entry.snapshot;
  const pos = s?.pos ?? entry.pos ?? (entry.gender === "de" || entry.gender === "het" ? "noun" : null);
  const pills = s ? sensePills(s) : [];
  const article = entry.gender === "de" || entry.gender === "het" || entry.gender === "de/het" ? entry.gender : "";
  const word = article ? `${article} ${entry.dutch}` : entry.dutch;
  const contextId = `ctx-${entry.id}`;
  return (
    <div className={`dict-card${open ? " is-open" : ""}`}>
      <div className="dict-card__row">
        <div className="dict-card__info">
          <div className="dict-card__status">
            <MasteryStatus mastery={mastery} />
            {tricky && <span className="tricky-tag">Tricky</span>}
            {entry.personal && <InfoPill kind="personal" />}
            {pills.map((p) => (
              <InfoPill key={p} kind={p} />
            ))}
          </div>
          <div className="dict-card__text">
            <div className="dict-card__line">
              <button type="button" className="dict-card__main" aria-expanded={open} aria-controls={open ? contextId : undefined} onClick={onToggle}>
                <span className="dict-card__word" lang="nl">
                  {word}
                  {s?.pos === "noun" && s.articleUnverified && <span className="sr-only"> (article not verified yet)</span>}
                </span>
                <ChevronDown className="dict-card__arrow" />
              </button>
              {pos && <PosPill pos={pos} />}
            </div>
            <span className="dict-card__gloss" lang="en">
              {entry.english}
            </span>
          </div>
        </div>
        <MoreMenu
          label={`More actions for ${word}`}
          actions={[
            { label: "Edit", onSelect: onEdit },
            { label: "Delete", onSelect: onDelete, tone: "danger" },
          ]}
        />
      </div>
      {open && (
        <div className="dict-card__context" id={contextId}>
          {children}
        </div>
      )}
    </div>
  );
}

/* CompoundCard — what to show when a word isn't in the dictionary because
   it never could be: a Dutch compound built out of words that are.

   Dutch glues words together productively, so "belastingaanslag",
   "huurtoeslag" and "inburgeringscursus" are ordinary municipal vocabulary
   that no finite word list can contain. Splitting them is the only way
   they're ever findable — see lib/decompose.

   What this deliberately does NOT do is invent a translation for the
   compound. Sticking the parts' glosses together reads plausibly and can be
   flatly wrong: "belastingaanslag" would come out as "tax + attack",
   because "aanslag" defaults to the attack sense — which is precisely the
   confidently-wrong answer run 04 caught and recommendations.md item 1
   exists to prevent. So the breakdown is shown as comprehension help, and
   what can be ADDED is each real part, with its own real gloss, article and
   example sentence.

   (Once senses are first-class — Phase B — the head's meaning can be picked
   rather than assumed, and the compound itself becomes addable with a gloss
   the learner chose instead of one we guessed.) */
import type { Compound } from "../lib/decompose";
import type { DictionaryEntry } from "../lib/types";
import { DeinflectionCard } from "./DeinflectionCard";

export function CompoundCard({
  word,
  compound,
  resolve,
  onAdd,
}: {
  /** The word as the learner typed or tapped it. */
  word: string;
  compound: Compound;
  /** Turns a part's base form into its dictionary entry. */
  resolve: (id: string) => DictionaryEntry | undefined;
  onAdd: (entry: DictionaryEntry) => void;
}) {
  const entries = compound.parts
    .map((part) => ({ part, entry: resolve(part) }))
    .filter((p): p is { part: string; entry: DictionaryEntry } => Boolean(p.entry));

  if (entries.length < 2) return null;

  return (
    <div className="addword__block">
      <div className="eyebrow">A compound of words you can look up</div>

      {/* The breakdown itself — the piece that makes the long word readable
          at a glance, before any of the parts are added to anything. */}
      <div className="compound__breakdown">
        <span className="compound__word">{word}</span>
        <span className="compound__equals">=</span>
        {compound.parts.map((part, i) => (
          <span key={part + i}>
            {i > 0 && <span className="compound__plus">+</span>}
            <span className="compound__part">{part}</span>
          </span>
        ))}
      </div>

      <p className="muted compound__note">
        The last part, <strong>{compound.head}</strong>, carries the meaning and the article.
      </p>

      <div className="sense-list">
        {entries.map(({ part, entry }, i) => (
          <DeinflectionCard
            key={part}
            entry={entry}
            reason={i === entries.length - 1 ? "main word" : "describes the main word"}
            onAdd={() => onAdd(entry)}
          />
        ))}
      </div>
    </div>
  );
}

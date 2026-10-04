/* WordLookupResult — renders whatever a useWordLookup pipeline resolved to:
   a spelling-suggestion row, an ambiguous-deinflection picker, a single
   deinflection's explanation, a found word (one sense or several), "already
   in deck", or a not-found/failed state.

   Shared by Capture (typed into a search field) and Add from text (tapped
   out of pasted reading) — they differ only in how the query is chosen and
   where a save's result goes, not in what a resolved word looks like. */
import type { DictionaryEntry } from "../lib/types";
import type { WordLookup } from "../lib/useWordLookup";
import { entryForSense, lookupLocal, parseSenseKey, senseKey } from "../lib/wordSources";
import { CompoundCard } from "./CompoundCard";
import { DeinflectionCard } from "./DeinflectionCard";
import { GenderChip } from "./GenderChip";
import { MasteryBar } from "./MasteryBar";
import { Notice } from "./Notice";
import { SenseCard } from "./SenseCard";
import { WordCard } from "./WordCard";

export function WordLookupResult({
  lookup,
  deckIds,
  levels,
  onSave,
  onEditSuggestion,
}: {
  lookup: WordLookup;
  deckIds: Set<string>;
  levels: Map<string, number>;
  onSave: (entry: DictionaryEntry) => void;
  /** Replaces the query with a tapped suggestion — only meaningful when the
   *  caller has an editable query to replace (Capture's search field). Omit
   *  to hide the suggestion row entirely: Add from text has no field to put
   *  a correction into, only the word as it was actually printed. */
  onEditSuggestion?: (dutch: string) => void;
}) {
  const {
    trimmed,
    entry,
    deinflections,
    deinflectionAmbiguous,
    compounds,
    suggestions,
    showSuggestions,
    searching,
    slow,
    notFound,
    failed,
    retry,
  } = lookup;
  // Every meaning of the resolved word, each with its own deck key and its
  // own answer to "is this saved yet". Reviewed meanings (authored, with an
  // example) are offered as the real choice; provisional ones — split out of
  // a packed gloss and not yet given an example — are offered below them.
  const baseId = entry ? parseSenseKey(entry.id).baseId : "";
  const senseOptions = (entry?.senses ?? []).map((sense, index) => {
    const key = senseKey(baseId, index);
    return { sense, index, key, inDeck: deckIds.has(key) };
  });
  const reviewed = senseOptions.filter((o) => !o.sense.provisional);
  const provisional = senseOptions.filter((o) => o.sense.provisional);

  // Why the headword on screen isn't what was typed. It reads as a footnote
  // on the answer rather than a banner above it: an info box before the card
  // interrupts the one thing the learner came for, and the grammar is a
  // detail about how they got here, so it sits after the content instead.
  const grammarNote =
    deinflections.length === 1 && entry
      ? `\u201C${trimmed}\u201D \u2192 ${deinflections[0].lemma} (${deinflections[0].reason})`
      : undefined;

  return (
    <>
      {/* ── Suggestions ── near-matches, offered next to the online result
          rather than in place of it. */}
      {onEditSuggestion && showSuggestions && (
        <div className="addword__block">
          <div className="eyebrow">Did you mean</div>
          <div className="suggestion-row">
            {suggestions.map((s) => (
              <button key={s.id} className="btn btn--secondary" onClick={() => onEditSuggestion(s.dutch)}>
                {s.dutch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Searching ── only for genuinely slow responses (>180ms); fast ones
          resolve before this ever appears, so there's no flash. A line of text
          alone left the screen looking empty on a slow connection, so the
          placeholder card carries the wait and holds the space the answer will
          occupy. The bars are decorative (aria-hidden): the wrapper's status
          role announces the sentence, which is the part worth hearing. */}
      {searching && slow && (
        <div className="addword__block" role="status">
          <div className="wordcard wordcard--loading" aria-hidden="true">
            <div className="skeleton skeleton--chip" />
            <div className="skeleton skeleton--word" />
            <div className="skeleton skeleton--gloss" />
            <div className="wordcard__rule" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--line-short" />
          </div>
          <p className="muted lookup-note">
            Searching the online dictionary…
          </p>
        </div>
      )}

      {/* ── Ambiguous deinflection ── Dutch can inflect two unrelated words
          identically — "sloten" is both "locks" and "ditches" — so more than
          one real candidate means there isn't a single right answer to
          assert. Same shape as the sense picker below: every candidate its
          own card, its own Add button, nothing pre-selected. */}
      {deinflectionAmbiguous && (
        <div className="addword__block">
          <div className="eyebrow">Which word did you mean?</div>
          <div className="sense-list">
            {deinflections.map((d) => {
              const candidate = lookupLocal(d.lemma);
              if (!candidate) return null;
              return (
                <DeinflectionCard
                  key={d.lemma}
                  entry={candidate}
                  reason={d.reason}
                  inDeck={deckIds.has(candidate.id)}
                  onAdd={() => onSave(candidate)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Compound ── the word isn't missing, it's built: Dutch writes
          "belasting" + "aanslag" as one word, and no dictionary of any size
          can hold every combination. Shown only once an exact match and
          deinflection have both failed, so a real headword is never
          re-explained as a compound of two others. */}
      {compounds.length > 0 && (
        <CompoundCard
          word={trimmed}
          compound={compounds[0]}
          resolve={lookupLocal}
          isInDeck={(id) => deckIds.has(id)}
          onAdd={onSave}
        />
      )}

      {/* ── Found ──────────────────────────────────────────────────────
          Meanings, each with its own place in the deck.

          The old shape of this screen asked "is this WORD in your deck?" and
          ended the interaction if it was. That was the dead end: a learner
          who saved "aanslag" as a tax assessment and later met it meaning an
          attack was told they already had the word, with nothing to tap. Now
          each meaning is its own card with its own key (see lib/wordSources),
          so the answer is per-meaning and the other ones stay addable. */}
      {entry && (
        <>
          {reviewed.length > 1 && (
            <div className="addword__block">
              <div className="eyebrow">Which meaning fits?</div>
              <div className="sense-list">
                {reviewed.map(({ sense, index, inDeck: senseInDeck }) => (
                  <SenseCard
                    key={index}
                    dutch={entry.dutch}
                    sense={sense}
                    inDeck={senseInDeck}
                    onAdd={() => onSave(entryForSense(entry, index))}
                  />
                ))}
              </div>
              {grammarNote && <p className="wordcard__note">{grammarNote}</p>}
            </div>
          )}

          {/* One reviewed meaning: the ordinary card, or the deck row when
              it's already saved. */}
          {reviewed.length === 1 && !reviewed[0].inDeck && (
            <div className="addword__block">
              <WordCard entry={entry} note={grammarNote} />
              <button className="btn btn--primary" onClick={() => onSave(entryForSense(entry, reviewed[0].index))}>
                Add to deck
              </button>
            </div>
          )}

          {reviewed.length === 1 && reviewed[0].inDeck && (
            <div className="addword__block">
              <div className="wordrow">
                <div className="wordrow__row">
                  <div className="wordrow__main">
                    <div className="wordrow__content">
                      <span className="wordrow__head">
                        <GenderChip gender={entry.gender} size="sm" />
                        <span className="wordrow__dutch">{entry.dutch}</span>
                      </span>
                      <span className="wordrow__gloss">{entry.english}</span>
                    </div>
                  </div>
                  <MasteryBar level={levels.get(reviewed[0].key) ?? 0} withLabel />
                </div>
              </div>
              {grammarNote && <p className="wordcard__note">{grammarNote}</p>}
              <Notice type="info">You already have this meaning in your deck</Notice>
            </div>
          )}

          {/* ── Other meanings ── the ones split mechanically out of a packed
              gloss ("to park; to put away"). Real meanings, but nobody has
              reviewed them and they have no example sentence yet, so they sit
              below the reviewed ones rather than competing with them as equal
              choices. Still addable: a meaning you can see and can't save is
              the same dead end in a smaller form. */}
          {provisional.length > 0 && (
            <div className="addword__block">
              <div className="eyebrow">Also means</div>
              <div className="sense-list">
                {provisional.map(({ sense, index, inDeck: senseInDeck }) => (
                  <SenseCard
                    key={index}
                    dutch={entry.dutch}
                    sense={sense}
                    inDeck={senseInDeck}
                    onAdd={() => onSave(entryForSense(entry, index))}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Not found ── the near-matches are rendered once, above, for
          every state that still has them. */}
      {notFound && (
        <div className="addword__block">
          <Notice type="caution">We couldn&rsquo;t find &ldquo;{trimmed}&rdquo;</Notice>
        </div>
      )}

      {failed && (
        <div className="addword__block">
          <Notice type="error">
            The online dictionary didn&rsquo;t respond. Check your connection and try again.
          </Notice>
          <button className="btn btn--secondary" onClick={retry}>
            Try again
          </button>
        </div>
      )}
    </>
  );
}

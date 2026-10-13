/* AddFromText — "Add from text": paste Dutch you're reading, tap a word,
   add the meaning that fits — with the sentence it came from kept as that
   sense's own example (source: captured).

   A tap is looked up in its sentence (lib/dictionary/units):

     - a separable verb or an expression around it is offered as a whole
       ("Ik bel je morgen op" → opbellen), both parts highlighted, and the
       single word stays available ("Just bellen");
     - an abbreviated pair ("in- en uitvoer") resolves to both full words;
     - a compound ("belastingaanslag", "GGD-test") is one token, so any tap
       on it selects all of it.

   The pasted text itself is never changed. */
import { Fragment, useEffect, useMemo, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import type { PersonalWord } from "../lib/dictionary/snapshot";
import { deckMembership } from "../lib/deckMembership";
import { senseItems } from "../components/SenseResults";
import { findTargetSpans } from "../lib/dictionary/checks";
import { unitsAt, type UnitOffer } from "../lib/dictionary/units";
import { tokenizeText, type TextToken } from "../lib/tokenizeText";
import { useLookup } from "../lib/useLookup";
import { Appbar } from "../components/Appbar";
import { Notice } from "../components/Notice";
import { SenseResults } from "../components/SenseResults";

interface Active {
  token: TextToken;
  index: number;
}

/** What the learner chose to look up for a tap: the word itself, or a unit. */
type Choice = { kind: "word"; form: string } | { kind: "unit"; offer: UnitOffer; form: string };

/** "Just bellen": the single word, as its verb when the unit is a separable
 *  verb (opbellen minus its particle), as written otherwise. */
function justWord(offers: UnitOffer[], sentence: string, tapped: string): string {
  const sep = offers.find((o) => o.kind === "separable" && o.spans.length > 1);
  if (!sep) return tapped;
  const [s, e] = sep.spans[sep.spans.length - 1];
  const particle = sentence.slice(s, e).toLowerCase();
  const unit = sep.forms[0];
  return unit.toLowerCase().startsWith(particle) ? unit.slice(particle.length) : tapped;
}

/** Stores the sentence as the sense's example — the learner's own. */
function withCapturedSentence(entry: DictionaryEntry, sentence: string): DictionaryEntry {
  const s = entry.snapshot;
  if (!s) return { ...entry, metIn: sentence };
  const spans = findTargetSpans(sentence, [s.form, ...s.forms.map((f) => f.form)]) ?? [];
  const captured = { nl: sentence, en: "", targetSpans: spans, source: "captured" as const };
  return { ...entry, metIn: sentence, snapshot: { ...s, examples: [captured, ...s.examples.filter((e) => e.source !== "captured")] } };
}

export function AddFromText({
  deckEntries,
  onSave,
  onSavePersonal,
  onBack,
}: {
  deckEntries: DictionaryEntry[];
  onSave: (entries: DictionaryEntry[]) => void;
  onSavePersonal: (form: string, word: PersonalWord, sentence: string) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [frozenText, setFrozenText] = useState<string | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [offers, setOffers] = useState<UnitOffer[] | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [addedCount, setAddedCount] = useState(0);
  const membership = useMemo(() => deckMembership(deckEntries), [deckEntries]);

  const { tokens, sentences } = useMemo(
    () => (frozenText ? tokenizeText(frozenText) : { tokens: [], sentences: [] }),
    [frozenText]
  );
  const sentence = active ? sentences[active.token.sentenceIndex] : "";

  // Units around the tapped word: offered before anything is looked up.
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setOffers(null);
    setChoice(null);
    unitsAt(sentence, { start: active.token.start, end: active.token.start + active.token.text.length }, controller.signal).then(
      (found) => {
        if (controller.signal.aborted) return;
        setOffers(found);
        if (!found.length) setChoice({ kind: "word", form: active.token.text });
      },
      () => {
        if (controller.signal.aborted) return;
        setOffers([]);
        setChoice({ kind: "word", form: active.token.text });
      }
    );
    return () => controller.abort();
  }, [active, sentence]);

  const lookupForm = choice?.kind === "unit" && choice.offer.kind === "coordination" ? null : choice?.form ?? null;
  const context = active && choice?.kind === "word" ? { text: sentence, start: active.token.start, end: active.token.start + active.token.text.length } : undefined;
  const lookup = useLookup(lookupForm, context);

  // With a sentence, the most likely sense — the first of the top word — is
  // preselected.
  const preselect = useMemo(() => {
    if (lookup.status !== "done") return [];
    const first = senseItems(lookup.result)[0];
    return first ? [first.snapshot.senseId] : [];
  }, [lookup]);

  function startReading() {
    if (!draft.trim()) return;
    setFrozenText(draft);
    setActive(null);
    setAddedIndices(new Set());
    setAddedCount(0);
  }

  function save(entries: DictionaryEntry[]) {
    if (!active) return;
    const fresh = entries.filter((e) => !membership.has({ senseId: e.id, form: e.dutch, gloss: e.english }));
    if (!fresh.length) return;
    onSave(fresh.map((e) => withCapturedSentence(e, sentence)));
    setAddedIndices((prev) => new Set(prev).add(active.index));
    setAddedCount((n) => n + fresh.length);
  }

  if (!frozenText) {
    return (
      <div className="screen">
        <Appbar title="Add from text" onBack={onBack} />
        <div className="screen__body gutter add-body add-body--compose">
          <p className="muted add-lede">
            Paste or type a bit of Dutch — an article, a letter, a sign. Then tap any word to look it up and add it,
            with the sentence you found it in kept alongside.
          </p>
          <textarea
            className="text-input text-input--area"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste or type a piece of Dutch text here…"
            aria-label="Dutch text to read and capture words from"
            lang="nl"
            autoFocus
          />
          <button className="btn btn--primary" disabled={!draft.trim()} onClick={startReading}>
            Start reading
          </button>
        </div>
      </div>
    );
  }

  // Highlights: the tapped word, and every part of a chosen unit.
  const unitSpans = choice?.kind === "unit" ? choice.offer.spans : [];
  const highlighted = (t: TextToken) =>
    active !== null &&
    t.sentenceIndex === active.token.sentenceIndex &&
    unitSpans.some(([s, e]) => s <= t.start && t.start + t.text.length <= e);

  return (
    <div className="screen">
      <Appbar title="Add from text" onBack={onBack} />
      <div className="screen__body gutter add-body">
        {addedCount > 0 && (
          <Notice type="success">
            {addedCount} word{addedCount === 1 ? "" : "s"} added this visit
          </Notice>
        )}

        <p className="readtext" lang="nl">
          {tokens.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && t.sentenceIndex !== tokens[i - 1].sentenceIndex && " "}
              {t.isWord ? (
                <button
                  className={[
                    "readtext__word",
                    active?.index === i ? "readtext__word--active" : "",
                    highlighted(t) ? "readtext__word--unit" : "",
                    addedIndices.has(i) ? "readtext__word--added" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setActive({ token: t, index: i })}
                  aria-pressed={active?.index === i}
                  aria-label={addedIndices.has(i) ? `${t.text}, already added to your deck` : undefined}
                >
                  {t.text}
                </button>
              ) : (
                <span>{t.text}</span>
              )}
            </Fragment>
          ))}
        </p>

        <button className="link-btn readtext__edit" onClick={() => setFrozenText(null)}>
          Edit the text
        </button>

        {active && (
          <div className="addword__block readtext__lookup">
            {offers === null && (
              <p className="muted" role="status">
                Looking at the sentence…
              </p>
            )}

            {offers && offers.length > 0 && (
              <div className="unit-offers" role="group" aria-label="What do you want to look up?">
                <div className="eyebrow">Part of a longer unit</div>
                {offers.map((o) => {
                  const label = o.kind === "coordination" ? o.forms.join(" and ") : o.forms[0];
                  const on = choice?.kind === "unit" && choice.offer === o;
                  return (
                    <button key={label} className={`unit-offer${on ? " is-selected" : ""}`} aria-pressed={on} onClick={() => setChoice({ kind: "unit", offer: o, form: o.forms[0] })}>
                      <span lang="nl" className="unit-offer__form">
                        {label}
                      </span>
                      <span className="unit-offer__kind">
                        {o.kind === "separable" ? "separable verb" : o.kind === "coordination" ? "both full words" : "expression"}
                      </span>
                    </button>
                  );
                })}
                <button
                  className={`unit-offer${choice?.kind === "word" ? " is-selected" : ""}`}
                  aria-pressed={choice?.kind === "word"}
                  onClick={() => setChoice({ kind: "word", form: active.token.text })}
                >
                  Just <span lang="nl">{justWord(offers, sentence, active.token.text)}</span>
                </button>
              </div>
            )}

            {choice?.kind === "unit" && choice.offer.kind === "coordination" && (
              <CoordinationResults offer={choice.offer} isInDeck={(s) => membership.has(s)} onSave={save} />
            )}

            {lookupForm && lookup.status === "loading" && (
              <div className="result-card result-card--loading" role="status" aria-label="Looking up the word">
                <div className="skeleton skeleton--word" />
              </div>
            )}
            {lookupForm && lookup.status === "error" && (
              <div className="addword__block">
                <Notice type="error">The dictionary didn&rsquo;t respond. Check your connection and try again.</Notice>
                <button className="btn btn--secondary" onClick={lookup.retry}>
                  Try again
                </button>
              </div>
            )}
            {lookupForm && lookup.status === "done" && (
              <SenseResults
                result={lookup.result}
                isInDeck={(i) => membership.has(i.snapshot)}
                onSave={save}
                preselect={preselect}
                sentence={sentence}
                onSavePersonal={(form, word) => {
                  onSavePersonal(form, word, sentence);
                  setAddedCount((n) => n + 1);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The two full words of "in- en uitvoer", each with its own senses. */
function CoordinationResults({
  offer,
  isInDeck,
  onSave,
}: {
  offer: UnitOffer;
  isInDeck: (s: { senseId: string; form: string; gloss: string }) => boolean;
  onSave: (entries: DictionaryEntry[]) => void;
}) {
  return (
    <>
      {offer.words.map((w) => (
        <SenseResults
          key={w.id}
          result={{ query: w.form, matches: [{ word: w, useIds: null, via: "lemma", matched: w.form }], compound: null, didYouMean: [] }}
          isInDeck={(i) => isInDeck(i.snapshot)}
          onSave={onSave}
        />
      ))}
    </>
  );
}

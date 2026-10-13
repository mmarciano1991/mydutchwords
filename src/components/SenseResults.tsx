/* SenseResults — every sense of a looked-up word as a result_card, in one
   vertical list ordered by frequency. No carousel, no hidden "other
   meanings".

     A  one sense, not in the deck      "+" adds it in one tap
     B  several senses                  checkboxes; "Save 2 words" adds the
                                        selected ones, disabled with none
     C  every sense already in the deck green cards, "In your deck"
     D  mixed                           green cards for the saved ones; "+"
                                        or checkboxes for the rest

   Membership is per SENSE id: the same sense is never added twice, even
   reached through another form or spelling. Selection is local until
   confirmed, and the confirm action locks after the first tap.

   Shared by Add a word (typed), Add from text (tapped, with the sentence)
   and onboarding. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { compoundParts, mainParts } from "../lib/dictionary/compound";
import { grammarNote } from "../lib/dictionary/grammar";
import { POS_LABEL, POS_ORDER, type CompoundNode, type Pos, type SenseSnapshot, type WordEntry } from "../lib/dictionary/model";
import type { LookupResult, WordMatch } from "../lib/dictionary/service";
import { dictionarySource } from "../lib/dictionary/service";
import { entryOf, onlineEntry, personalWordGaps, snapshotOf, type PersonalWord } from "../lib/dictionary/snapshot";
import { lookupWiktionary } from "../lib/wiktionary";
import type { DictionaryEntry } from "../lib/types";
import { Notice } from "./Notice";
import { ResultCard, type ResultControl } from "./ResultCard";

export interface SenseItem {
  snapshot: SenseSnapshot;
  entry: DictionaryEntry;
  /** Why the headword differs from what was typed ("Past tense of lopen."). */
  grammar?: string;
}

/** Every sense a lookup reached, in display order. An inflected form shows
 *  its headword — the infinitive for a verb — with the step explained. */
export function senseItems(result: LookupResult): SenseItem[] {
  const out: SenseItem[] = [];
  const seen = new Set<string>();
  const words: { word: WordEntry; useIds: string[] | null; match?: WordMatch }[] = result.matches.map((m) => ({ word: m.word, useIds: m.useIds, match: m }));
  if (result.compound) words.push({ word: result.compound.word, useIds: null });
  for (const { word, useIds, match } of words) {
    for (const use of word.uses) {
      if (useIds && !useIds.includes(use.id)) continue;
      const grammar = (match && grammarNote(word.form, use, match)) || undefined;
      for (const sense of [...use.senses].sort((a, b) => a.rank - b.rank)) {
        if (seen.has(sense.id)) continue;
        seen.add(sense.id);
        const snapshot = snapshotOf(word, use, sense);
        out.push({ snapshot, entry: entryOf(snapshot), grammar });
      }
    }
  }
  return out;
}

/** Copy for the confirm button: "Save 1 word", "Save 2 words". */
export function saveLabel(n: number): string {
  return n === 0 ? "Save the words" : `Save ${n} word${n === 1 ? "" : "s"}`;
}

export function SenseResults({
  result,
  isInDeck,
  onSave,
  preselect,
  onPickSuggestion,
  onSavePersonal,
  sentence,
}: {
  result: LookupResult;
  /** True when this sense is in the deck (by id, or a legacy card of the
   *  same word and meaning). */
  isInDeck: (item: SenseItem) => boolean;
  /** Adds the given senses. Called once per confirmation. */
  onSave: (entries: DictionaryEntry[]) => void;
  /** Sense ids to preselect (the context sense, from a sentence). */
  preselect?: string[];
  /** A "Did you mean…?" suggestion was picked. */
  onPickSuggestion?: (form: string) => void;
  /** Saves the query as a personal word, as the learner described it. */
  onSavePersonal?: (form: string, word: PersonalWord) => void;
  /** The sentence the word was met in (Add from text) — offered as the
   *  personal word's example. */
  sentence?: string;
}) {
  const items = useMemo(() => senseItems(result), [result]);
  const addable = items.filter((i) => !isInDeck(i));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselect ?? []));
  const [locked, setLocked] = useState(false);
  const resultKey = items.map((i) => i.snapshot.senseId).join("|");

  // A new result (another word) starts a fresh selection.
  useEffect(() => {
    setSelected(new Set((preselect ?? []).filter((id) => items.some((i) => i.snapshot.senseId === id))));
    setLocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  // Once the selected senses are in the deck, the action unlocks for the rest.
  const addableIds = addable.map((i) => i.snapshot.senseId).join("|");
  useEffect(() => {
    setLocked(false);
    setSelected((prev) => new Set([...prev].filter((id) => addableIds.split("|").includes(id))));
  }, [addableIds]);

  const multi = addable.length >= 2;
  const control = (item: SenseItem): ResultControl => (isInDeck(item) ? "inDeck" : multi ? "checkbox" : "add");
  const count = [...selected].filter((id) => addable.some((i) => i.snapshot.senseId === id)).length;

  function addOne(item: SenseItem) {
    if (locked) return;
    setLocked(true);
    onSave([item.entry]);
  }

  function confirm() {
    if (locked || count === 0) return;
    setLocked(true);
    onSave(addable.filter((i) => selected.has(i.snapshot.senseId)).map((i) => i.entry));
  }

  const nothing = items.length === 0;

  return (
    <div className="sense-results">
      {result.compound && <CompoundBreakdown node={result.compound.node} />}

      {items.length > 0 && (
        <ul className="result-list" aria-label={`Meanings of ${result.query}`}>
          {items.map((item) => (
            <li key={item.snapshot.senseId}>
              <ResultCard
                sense={item.snapshot}
                grammar={item.grammar}
                control={control(item)}
                checked={selected.has(item.snapshot.senseId)}
                disabled={locked}
                onAdd={() => addOne(item)}
                onToggle={(on) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(item.snapshot.senseId);
                    else next.delete(item.snapshot.senseId);
                    return next;
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      {multi && (
        <div className="sense-results__actions">
          <button className="btn btn--primary" disabled={count === 0 || locked} onClick={confirm}>
            {saveLabel(count)}
          </button>
        </div>
      )}

      {nothing && result.didYouMean.length > 0 && (
        <div className="addword__block">
          <div className="eyebrow" id="dym-label">Did you mean…?</div>
          <div className="suggestion-row" role="group" aria-labelledby="dym-label">
            {result.didYouMean.map((s) => (
              <button key={s.wordId} className="btn btn--secondary" lang="nl" onClick={() => onPickSuggestion?.(s.form)}>
                {s.form}
              </button>
            ))}
          </div>
        </div>
      )}

      {nothing && result.didYouMean.length === 0 && (
        <OnlineResult form={result.query} isInDeck={isInDeck} onSave={onSave} fallback={<NotFound form={result.query} sentence={sentence} onSavePersonal={onSavePersonal} />} />
      )}
    </div>
  );
}

/** Not in our dictionary (or held back for review): the online dictionary's
 *  answer, shown with its source — or, without one, "Word not found". */
function OnlineResult({
  form,
  isInDeck,
  onSave,
  fallback,
}: {
  form: string;
  isInDeck: (item: SenseItem) => boolean;
  onSave: (entries: DictionaryEntry[]) => void;
  fallback: ReactNode;
}) {
  const [state, setState] = useState<{ status: "loading" | "none" | "error" } | { status: "found"; items: SenseItem[] }>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    lookupWiktionary(form, { signal: controller.signal }).then(
      (entry) => {
        if (controller.signal.aborted) return;
        if (!entry) return setState({ status: "none" });
        const items = entry.senses.map((s, i) => {
          const e = onlineEntry(entry.dutch, i, s);
          return { snapshot: e.snapshot!, entry: e };
        });
        setState(items.length ? { status: "found", items } : { status: "none" });
      },
      () => !controller.signal.aborted && setState({ status: "error" })
    );
    return () => controller.abort();
  }, [form]);

  if (state.status === "loading") return <p className="muted" role="status">Not in our dictionary — checking the online dictionary…</p>;
  if (state.status !== "found") return <>{fallback}</>;
  return (
    <div className="addword__block">
      <p className="source-note">From the online dictionary (Wiktionary). Not checked by Woordkast yet.</p>
      <ul className="result-list">
        {state.items.map((item) => (
          <li key={item.snapshot.senseId}>
            <ResultCard sense={item.snapshot} control={isInDeck(item) ? "inDeck" : "add"} onAdd={() => onSave([item.entry])} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Word not found" + saving it as a personal word. Every card needs a
 *  translation, a word type and a sentence, so all three are asked for (the
 *  sentence the word was met in is offered first); a noun's article is the
 *  learner's to state, or "Not sure" — never guessed. */
function NotFound({ form, sentence, onSavePersonal }: { form: string; sentence?: string; onSavePersonal?: (form: string, word: PersonalWord) => void }) {
  const [translation, setTranslation] = useState("");
  const [pos, setPos] = useState<Pos | "">("");
  const [article, setArticle] = useState<"de" | "het" | "">("");
  const [example, setExample] = useState(sentence ?? "");
  const [exampleEn, setExampleEn] = useState("");
  const [saved, setSaved] = useState(false);
  const word = { translation, pos: pos || undefined, article: article || undefined, example, exampleEn };
  const missing = personalWordGaps(word);
  return (
    <div className="addword__block">
      <Notice type="caution">
        Word not found: <span lang="nl">&ldquo;{form}&rdquo;</span>
      </Notice>
      {onSavePersonal && !saved && (
        <form
          className="personal-word"
          aria-label="Save as a personal word"
          onSubmit={(e) => {
            e.preventDefault();
            if (missing.length || !word.pos) return;
            setSaved(true);
            onSavePersonal(form, { ...word, pos: word.pos });
          }}
        >
          <label className="auth-field">
            <span className="auth-field__label">Your translation</span>
            <input className="text-input" value={translation} onChange={(e) => setTranslation(e.target.value)} lang="en" autoComplete="off" required />
          </label>
          <label className="auth-field">
            <span className="auth-field__label">Word type</span>
            <select className="text-input" value={pos} onChange={(e) => setPos(e.target.value as Pos | "")} required>
              <option value="">Choose…</option>
              {POS_ORDER.map((p) => (
                <option key={p} value={p}>
                  {POS_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          {pos === "noun" && (
            <label className="auth-field">
              <span className="auth-field__label">Article</span>
              <select className="text-input" value={article} onChange={(e) => setArticle(e.target.value as "de" | "het" | "")}>
                <option value="">Not sure</option>
                <option value="de">de</option>
                <option value="het">het</option>
              </select>
            </label>
          )}
          <label className="auth-field">
            <span className="auth-field__label">Example sentence</span>
            <input className="text-input" value={example} onChange={(e) => setExample(e.target.value)} lang="nl" autoComplete="off" placeholder={`A Dutch sentence with “${form}”`} required />
          </label>
          <label className="auth-field">
            <span className="auth-field__label">Its translation (optional)</span>
            <input className="text-input" value={exampleEn} onChange={(e) => setExampleEn(e.target.value)} lang="en" autoComplete="off" />
          </label>
          <button className="btn btn--secondary" disabled={missing.length > 0}>
            Save as a personal word
          </button>
        </form>
      )}
    </div>
  );
}

/** The parts of a compound: the two main parts first; a part that is itself
 *  a compound opens on demand. A name or acronym is shown as written. */
function CompoundBreakdown({ node }: { node: CompoundNode }) {
  const [open, setOpen] = useState<CompoundNode | null>(null);
  const [sub, setSub] = useState<CompoundNode | null>(null);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (open.left) {
      setSub(open);
      return;
    }
    if (!open.wordId || requested.current === open.wordId) return;
    requested.current = open.wordId;
    void dictionarySource()
      .words([open.wordId])
      .then(([w]) => setSub(w?.compound ?? null))
      .catch(() => setSub(null));
  }, [open]);

  const parts = mainParts(node);
  return (
    <div className="compound" aria-label="How this word is built">
      <div className="compound__breakdown">
        {parts.map((p, i) => (
          <span key={p.form + i} className="compound__piece">
            {i > 0 && <span className="compound__plus" aria-hidden="true">+</span>}
            {(p.left || p.wordId) && p.componentKind === "lemma" ? (
              <button type="button" className="compound__part compound__part--open" lang="nl" aria-expanded={open === p} onClick={() => setOpen(open === p ? null : p)}>
                {p.form}
              </button>
            ) : (
              <span className="compound__part" lang="nl">
                {p.form}
                {p.componentKind !== "lemma" && <span className="compound__kind"> ({p.componentKind === "abbreviation" ? "acronym" : "name"})</span>}
              </span>
            )}
          </span>
        ))}
      </div>
      {open && sub && (
        <p className="compound__sub" lang="nl">
          {compoundParts(sub).map((p, i) => (
            <span key={i}>
              {i > 0 && " + "}
              {p.form}
            </span>
          ))}
        </p>
      )}
      <p className="muted compound__note">
        The last part, <strong lang="nl">{parts[parts.length - 1].form}</strong>, gives the article and the plural.
      </p>
    </div>
  );
}

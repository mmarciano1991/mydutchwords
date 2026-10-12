/* Onboarding — the 2-minute promise.

   Four short screens, then straight into the first words — or, for a new
   user with no words yet, straight to adding the first one:

     1. Welcome      — the promise: small, daily, enough
     2. Commitment   — "How much Dutch fits your day?"
     3. Time         — "When will you do your Dutch?"
     4. Plan         — the choice read back as one sentence: "Every day at
                       08:00, I learn 10 Dutch words."

   For someone who already has words, the plan's button starts the first
   session directly. A new user gets two more screens:

     5. Start        — "How do you want to begin?": add 3 words they have
                       met, or take 3 starter words
     6. Words        — either three "Add a word" screens, one word each
                       (the same lookup and result as Capture), or the three
                       starter words to look at before beginning

   Either way onboarding ends in the first session, on those three words.
   There is still no starter deck: starters are three words, offered once,
   and only when the user asks for them.

   Every choice is editable later in Settings, and the screens say so —
   picking the small option should never feel like locking oneself in. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { DictionaryEntry } from "../lib/types";
import { deckMembership } from "../lib/deckMembership";
import { lookup as lookupWord } from "../lib/dictionary/service";
import { useLookup } from "../lib/useLookup";
import { STARTER_COUNT, pickStarterWords } from "../lib/starterWords";
import { SenseResults, senseItems } from "../components/SenseResults";
import { WordSearch } from "../components/WordSearch";
import { TulipMedallion } from "../components/brand";
import { GenderChip } from "../components/GenderChip";
import { Notice } from "../components/Notice";
import { CommitmentIcon } from "../components/CommitmentIcon";
import { IconButton } from "../components/IconButton";
import {
  COMMITMENTS,
  DEFAULT_HABIT_TIME,
  DEFAULT_WEEKLY_TARGET,
  commitmentOf,
  isHabitTime,
  planSentence,
  type Commitment,
  type HabitTime,
} from "../lib/habit";
import { Dock } from "../components/Dock";

type Step = "welcome" | "commitment" | "time" | "plan" | "start" | "words";
const STEPS_EXISTING: Step[] = ["welcome", "commitment", "time", "plan"];
const STEPS_NEW: Step[] = [...STEPS_EXISTING, "start", "words"];

/** How a new user's first words arrive. */
type FirstWords = "add" | "starter";

/** Each starter word's first meaning, from the dictionary; a word it
 *  can't find is simply skipped. */
async function starterEntries(forms: string[]): Promise<DictionaryEntry[]> {
  const found = await Promise.all(forms.map((f) => lookupWord(f).then((r) => senseItems(r)[0]?.entry, () => undefined)));
  return found.filter((e): e is DictionaryEntry => Boolean(e));
}

/** The starters for `forms`, loaded as they arrive. */
function useStarters(forms: string[]): DictionaryEntry[] {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const key = forms.join("|");
  useEffect(() => {
    let live = true;
    void starterEntries(forms).then((e) => live && setEntries(e));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return entries;
}

export function Onboarding({
  existingUser,
  deckEntries = [],
  onComplete,
}: {
  /** Already has words or history: the welcome speaks to a change of rhythm,
   *  and no starter deck is added. */
  existingUser: boolean;
  /** The deck, so a lookup can say "In your deck". */
  deckEntries?: DictionaryEntry[];
  /** `firstWords`: the new user's first three words, to add to the deck and
   *  practise straight away. Empty for an existing user. */
  onComplete: (choice: { commitment: Commitment; time: HabitTime }, firstWords: DictionaryEntry[]) => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [time, setTime] = useState<HabitTime>(DEFAULT_HABIT_TIME);
  // What the field shows, which may briefly be a half-typed (empty) time.
  const [timeInput, setTimeInput] = useState<string>(DEFAULT_HABIT_TIME);

  // ── First words (new users) ──
  const [way, setWay] = useState<FirstWords | null>(null);
  const [added, setAdded] = useState<DictionaryEntry[]>([]);
  const [starterIds, setStarterIds] = useState<string[]>(() => pickStarterWords());
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lookup = useLookup(picked);
  const starters = useStarters(starterIds);
  // A word added a moment ago reads as "In your deck" if looked up again.
  const membership = useMemo(() => deckMembership([...deckEntries, ...added]), [deckEntries, added]);
  const lastAdded = added.length > 0 ? added[added.length - 1] : null;

  const steps = existingUser ? STEPS_EXISTING : STEPS_NEW;
  const index = steps.indexOf(step);

  function editQuery(value: string) {
    setQuery(value);
    if (!value.trim()) setPicked(null);
  }

  function finish(firstWords: DictionaryEntry[]) {
    if (commitment) onComplete({ commitment, time }, firstWords);
  }

  /** One of the three "add a word" screens saved its word: on to the next,
   *  or — on the third — into the first session. */
  function addWords(entries: DictionaryEntry[]) {
    const fresh = entries.filter((e) => !membership.has({ senseId: e.id, form: e.dutch, gloss: e.english }));
    if (!fresh.length) return;
    const next = [...added, ...fresh];
    setQuery("");
    setPicked(null);
    if (next.length >= STARTER_COUNT) {
      finish(next);
      return;
    }
    setAdded(next);
    inputRef.current?.focus();
  }

  /** From the add screens: keep what was typed, top up with starters. */
  async function fillWithStarters() {
    const taken = new Set(added.map((e) => e.dutch));
    const fill = (await starterEntries(pickStarterWords(Math.random, taken))).filter((e) => !added.some((a) => a.id === e.id));
    finish([...added, ...fill].slice(0, STARTER_COUNT));
  }

  function back() {
    // On the add screens, Back steps back through the words already added.
    if (step === "words" && way === "add" && added.length > 0) {
      setAdded(added.slice(0, -1));
      setQuery("");
      setPicked(null);
      return;
    }
    if (index > 0) setStep(steps[index - 1]);
  }

  return (
    <div className="screen pad-top onb">
      <div className="onb__top gutter">
        {index > 0 ? <IconButton action="back" onClick={back} aria-label="Back" /> : <span className="onb__spacer" />}
        <div className="onb__steps" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s} className={`onb__step${i <= index ? " is-on" : ""}`} />
          ))}
        </div>
        <span className="onb__spacer" />
      </div>

      {step === "welcome" && (
        <>
          <div className="screen__body center-col gutter onb__body onb__body--center">
            <TulipMedallion size={132} />
            <h1 className="display--lg onb__title">
              {existingUser ? "A gentler rhythm" : "A little Dutch, every day"}
            </h1>
            <p className="onb__lead">
              {existingUser
                ? "Woordkast now fits around your day. Pick a small daily amount — doing a little every day beats doing a lot once a week."
                : "Five minutes is enough. We’ll keep it small enough to fit into even your busiest day — that’s how it becomes a habit."}
            </p>
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" onClick={() => setStep("commitment")}>
              {existingUser ? "Set my rhythm" : "Let’s start"}
            </button>
          </Dock>
        </>
      )}

      {step === "commitment" && (
        <>
          <div className="screen__body gutter onb__body">
            <h1 className="title-serif onb__question">How much Dutch fits your day?</h1>
            <p className="onb__hint">There&rsquo;s no right answer. Pick what you could still do on a bad day.</p>
            <div className="choice-list" role="radiogroup" aria-label="Daily amount">
              {COMMITMENTS.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={commitment === c.id}
                  className={`choice${commitment === c.id ? " is-selected" : ""}`}
                  onClick={() => setCommitment(c.id)}
                >
                  <CommitmentIcon className="choice__icon" commitment={c.id} size={28} />
                  <span className="choice__text">
                    <span className="choice__title">{c.name}</span>
                    <span className="choice__sub">
                      {c.words} words · ~{c.minutes} min
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="onb__note">Consistency matters more than size. You can change this anytime.</p>
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" disabled={!commitment} onClick={() => setStep("time")}>
              Continue
            </button>
          </Dock>
        </>
      )}

      {step === "time" && (
        <>
          <div className="screen__body gutter onb__body">
            <h1 className="title-serif onb__question">When will you do your Dutch?</h1>
            <p className="onb__hint">
              Pick a time right after something you already do every day. It&rsquo;s a cue, not a rule — any time still counts.
            </p>
            <input
              type="time"
              className="time-field time-field--lg"
              aria-label="Daily time"
              value={timeInput}
              onChange={(e) => {
                setTimeInput(e.target.value);
                if (isHabitTime(e.target.value)) setTime(e.target.value);
              }}
            />
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" disabled={!isHabitTime(timeInput)} onClick={() => setStep("plan")}>
              Continue
            </button>
          </Dock>
        </>
      )}

      {step === "plan" && commitment && (
        <>
          <div className="screen__body center-col gutter onb__body onb__body--center">
            <p className="eyebrow">Your plan</p>
            <p className="onb__plan">{planSentence(commitment, time)}</p>
            <ul className="onb__facts">
              <li>Done means done — anything more is a bonus, never tomorrow&rsquo;s homework.</li>
              <li>Aim for {DEFAULT_WEEKLY_TARGET} days a week. Missing a day is normal.</li>
            </ul>
          </div>
          <Dock className="gutter onb__foot">
            {existingUser ? (
              <button className="btn btn--primary" onClick={() => finish([])}>
                {`Start my first ${commitmentOf(commitment).words} words`}
              </button>
            ) : (
              <button className="btn btn--primary" onClick={() => setStep("start")}>
                Continue
              </button>
            )}
          </Dock>
        </>
      )}

      {step === "start" && (
        <>
          <div className="screen__body gutter onb__body">
            <h1 className="title-serif onb__question">How do you want to begin?</h1>
            <p className="onb__hint">
              Your first {STARTER_COUNT} words. Woordkast works best with Dutch you meet in your own day.
            </p>
            <div className="choice-list" role="radiogroup" aria-label="First words">
              <button
                role="radio"
                aria-checked={way === "add"}
                className={`choice${way === "add" ? " is-selected" : ""}`}
                onClick={() => setWay("add")}
              >
                <span className="choice__text">
                  <span className="choice__title">Add {STARTER_COUNT} words I’ve met</span>
                  <span className="choice__sub">From a sign, a letter or a colleague</span>
                </span>
              </button>
              <button
                role="radio"
                aria-checked={way === "starter"}
                className={`choice${way === "starter" ? " is-selected" : ""}`}
                onClick={() => setWay("starter")}
              >
                <span className="choice__text">
                  <span className="choice__title">Give me {STARTER_COUNT} to start</span>
                  <span className="choice__sub">Everyday words for life in the Netherlands</span>
                </span>
              </button>
            </div>
            <p className="onb__note">Either way, you can add your own words anytime.</p>
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" disabled={!way} onClick={() => setStep("words")}>
              Continue
            </button>
          </Dock>
        </>
      )}

      {step === "words" && way === "add" && (
        <>
          <div className="screen__body gutter onb__body">
            <p className="eyebrow">
              Word {added.length + 1} of {STARTER_COUNT}
            </p>
            <h1 className="title-serif onb__question">Add a Dutch word you’ve met</h1>
            <p className="onb__hint">Look it up, then add it to your deck.</p>
            <WordSearch
              value={query}
              onChange={editQuery}
              onPick={(p) => {
                setPicked(p.form);
                setQuery(p.form);
              }}
              inDeckWordIds={membership.wordIds}
              ariaLabel={`Search a Dutch word to add, word ${added.length + 1} of ${STARTER_COUNT}`}
              autoFocus
              inputRef={inputRef}
            />
            <div className="onb__lookup">
              {lastAdded && !query && (
                <Notice type="success">
                  <strong lang="nl">{lastAdded.dutch}</strong> added · {Math.max(0, STARTER_COUNT - added.length)} to go
                </Notice>
              )}
              {picked && lookup.status === "done" && (
                <SenseResults
                  result={lookup.result}
                  isInDeck={(i) => membership.has(i.snapshot)}
                  onSave={addWords}
                  onPickSuggestion={(form) => {
                    setPicked(form);
                    setQuery(form);
                  }}
                />
              )}
              {picked && lookup.status === "error" && <Notice type="error">The dictionary didn&rsquo;t respond. Check your connection and try again.</Notice>}
            </div>
          </div>
          <Dock className="gutter onb__foot">
            {added.length === 0 ? (
              <button className="link-btn link-btn--center" onClick={() => setWay("starter")}>
                Give me {STARTER_COUNT} to start instead
              </button>
            ) : (
              <button className="link-btn link-btn--center" onClick={() => void fillWithStarters()}>
                Fill the rest with starter words
              </button>
            )}
          </Dock>
        </>
      )}

      {step === "words" && way === "starter" && (
        <>
          <div className="screen__body gutter onb__body">
            <p className="eyebrow">Your first {STARTER_COUNT} words</p>
            <h1 className="title-serif onb__question">Words you’ll meet soon</h1>
            <p className="onb__hint">Everyday Dutch for life here. Add your own as you meet them.</p>
            <ul className="starter-list">
              {starters.map((e) => (
                <li key={e.id} className="starter-list__item">
                  <span className="starter-list__word">
                    <GenderChip gender={e.gender} />
                    <span lang="nl">{e.dutch}</span>
                  </span>
                  <span className="starter-list__gloss">{e.english}</span>
                </li>
              ))}
            </ul>
          </div>
          <Dock className="gutter onb__foot">
            <button className="btn btn--primary" onClick={() => finish(starters)}>
              Start with these {starters.length}
            </button>
            <button
              className="link-btn link-btn--center"
              onClick={() => setStarterIds((ids) => pickStarterWords(Math.random, new Set(ids)))}
            >
              Pick different ones
            </button>
          </Dock>
        </>
      )}
    </div>
  );
}

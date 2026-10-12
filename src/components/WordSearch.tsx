/* WordSearch — the Add-a-word field with autocomplete (Figma search input
   250:2486), following the WAI-ARIA combobox pattern:

     - the input is the combobox; suggestions are a listbox below it
     - ↑ ↓ move the active option, Enter picks it, Esc closes the list
       without clearing, Tab moves on; focus never leaves the input
       (aria-activedescendant points at the active option)
     - the count, loading, empty, offline and error states are announced
     - rows are at least 44 pt; autocorrect, autocapitalize and spellcheck
       are off; Dutch text is marked lang="nl"

   Field and suggestions are one card (Figma 465:5290): the list unfolds
   from under the field (300 ms, ease-out) and folds back on close.

   Each suggestion: the word with its article for a noun
   and the typed prefix highlighted (bold and underlined, not colour
   alone), its part-of-speech pill, a short gloss to tell meanings apart, a
   compound mark, and "In your deck". */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { prefixLength } from "../lib/dictionary/normalize";
import type { SuggestRow } from "../lib/dictionary/source";
import type { FuzzyRow } from "../lib/dictionary/source";
import { useDictionarySearch } from "../lib/useDictionarySearch";
import type { DictionaryEntry } from "../lib/types";
import type { Pos } from "../lib/dictionary/model";
import { SearchIcon } from "./icons";
import { PosPill } from "./PosPill";
import { Close } from "../icons";

/** What was picked: a suggestion, a "Did you mean…?", the compound, a
 *  or a saved word — always as the form to look up. */
export interface SearchPick {
  form: string;
  wordId?: string;
}

type Option =
  | { kind: "suggestion"; row: SuggestRow }
  | { kind: "typo"; row: FuzzyRow }
  | { kind: "compound"; form: string; gloss: string; article?: string; pos?: Pos }
  | { kind: "saved"; entry: DictionaryEntry }
  | { kind: "more" };

function Highlight({ form, query }: { form: string; query: string }) {
  const n = prefixLength(form, query);
  if (n === 0) return <>{form}</>;
  return (
    <>
      <mark className="suggest__match">{form.slice(0, n)}</mark>
      {form.slice(n)}
    </>
  );
}

export function WordSearch({
  value,
  onChange,
  onPick,
  inDeckWordIds,
  saved = [],
  placeholder = "Search a Dutch word",
  ariaLabel = "Search a Dutch word to add to your deck",
  autoFocus,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (pick: SearchPick) => void;
  /** Words with at least one sense in the deck. */
  inDeckWordIds: Set<string>;
  /** The deck's own words — searched when offline. */
  saved?: DictionaryEntry[];
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const search = useDictionarySearch(value, saved);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const trimmed = value.trim();

  const options: Option[] = useMemo(() => {
    if (!trimmed) return [];
    if (search.status === "offline") return search.offlineMatches.map((entry) => ({ kind: "saved", entry }) as Option);
    const r = search.result;
    if (!r) return [];
    const out: Option[] = r.suggestions.map((row) => ({ kind: "suggestion", row }));
    if (r.hasMore) out.push({ kind: "more" });
    for (const row of r.didYouMean) out.push({ kind: "typo", row });
    if (r.compound) {
      const sense = r.compound.word.uses[0]?.senses[0];
      const use = r.compound.word.uses[0];
      out.push({ kind: "compound", form: r.compound.form, gloss: sense?.gloss ?? "", article: use?.article, pos: use?.pos });
    }
    return out;
  }, [trimmed, search.status, search.offlineMatches, search.result]);

  // The active option resets whenever the list changes.
  useEffect(() => setActive(-1), [options]);
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const visible = open && options.length > 0;

  function pick(o: Option) {
    switch (o.kind) {
      case "more":
        search.showMore();
        return;
      case "suggestion":
        // An inflected form looks up what was typed ("liep" → lopen).
        onPick({ form: o.row.via === "form" ? o.row.matched : o.row.form, wordId: o.row.wordId });
        break;
      case "typo":
        onPick({ form: o.row.form, wordId: o.row.wordId });
        break;
      case "compound":
        onPick({ form: o.form });
        break;
      case "saved":
        onPick({ form: o.entry.dutch });
        break;
    }
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visible && active >= 0) pick(options[active]);
      else if (trimmed) {
        // Enter with nothing highlighted: look up exactly what was typed.
        setOpen(false);
        onPick({ form: trimmed });
      }
    } else if (e.key === "Escape") {
      // Closes the list; the text stays.
      if (visible) e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const announcement =
    !trimmed
      ? ""
      : search.status === "loading" || search.slow
        ? "Searching…"
        : search.status === "offline"
          ? `You're offline. Searching your saved words. ${search.offlineMatches.length} found.`
          : search.status === "error"
            ? "Search failed. Try again."
            : search.status === "empty"
              ? "No word found"
              : search.status === "results"
                ? `${search.result?.suggestions.length ?? 0} suggestions${search.result?.didYouMean.length ? `, ${search.result.didYouMean.length} spelling suggestions` : ""}`
                : "";

  const optionId = (i: number) => `${listId}-o${i}`;
  let typoHeaderShown = false;

  return (
    <div className={`word-search${visible ? " is-open" : ""}`}>
      <div className="word-search__card">
        <div className={`appbar__search word-search__field${value ? " appbar__search--active" : ""}${disabled ? " appbar__search--disabled" : ""}`}>
          <SearchIcon />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={visible}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={visible && active >= 0 ? optionId(active) : undefined}
            aria-label={ariaLabel}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            lang="nl"
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {value && (
            <button type="button" className="appbar__clear" onClick={() => onChange("")} aria-label="Clear search">
              <Close size={20} />
            </button>
          )}
        </div>

        {/* The card's lower half: stays rendered so it can fold away; hidden
            from taps and assistive tech once folded (see .suggest). */}
        <div className="suggest" aria-hidden={!visible}>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Suggestions"
            className="suggest__list"
            // Keep focus in the input: a tap on a row must not blur it first.
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => {
              const header =
                o.kind === "typo" && !typoHeaderShown ? (
                  ((typoHeaderShown = true),
                  (
                    <li key={`h${i}`} className="suggest__header" role="presentation">
                      Did you mean…?
                    </li>
                  ))
                ) : o.kind === "compound" ? (
                  <li key={`h${i}`} className="suggest__header" role="presentation">
                    A compound of words in the dictionary
                  </li>
                ) : null;
              const common = {
                id: optionId(i),
                role: "option" as const,
                "aria-selected": i === active,
                "data-index": i,
                className: `suggest__option${i === active ? " is-active" : ""}`,
                onClick: () => pick(o),
              };
              if (o.kind === "more") {
                return (
                  <li key="more" {...common} className={`${common.className} suggest__more`}>
                    Show more results
                  </li>
                );
              }
              if (o.kind === "saved") {
                return (
                  <li key={`s${o.entry.id}`} {...common}>
                    <SuggestBody form={o.entry.dutch} query={value} article={articleOfGender(o.entry.gender)} pos={o.entry.snapshot?.pos} gloss={o.entry.english} inDeck />
                  </li>
                );
              }
              if (o.kind === "compound") {
                return [
                  header,
                  <li key={`c${o.form}`} {...common}>
                    <SuggestBody form={o.form} query={value} article={o.article} pos={o.pos} gloss={o.gloss} compound />
                  </li>,
                ];
              }
              const row = o.row;
              const useId = "useId" in row ? row.useId : undefined;
              const first = (useId && row.preview.senses.find((s) => s.useId === useId)) || row.preview.senses[0];
              const article = first?.pos === "noun" && first.article !== "de/het" ? first.article : undefined;
              const glosses = row.preview.senses.slice(0, 2).map((s) => s.gloss).join(" · ");
              return [
                header,
                <li key={`${o.kind}${row.wordId}`} {...common}>
                  <SuggestBody
                    form={row.form}
                    query={value}
                    article={article}
                    pos={first?.pos}
                    gloss={glosses}
                    compound={row.preview.compound}
                    inDeck={inDeckWordIds.has(row.wordId)}
                    via={"via" in row && row.via === "form" ? row.matched : undefined}
                    more={row.preview.senseCount > 2 ? row.preview.senseCount - 2 : 0}
                  />
                </li>,
              ];
            })}
          </ul>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {trimmed && search.status === "offline" && open && (
        <p className="suggest__state">You&rsquo;re offline. Searching your saved words.</p>
      )}
      {trimmed && search.status === "error" && (
        <div className="suggest__state suggest__state--error">
          <span>Search isn&rsquo;t responding right now.</span>
          <button type="button" className="link-btn" onClick={search.retry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function articleOfGender(g: string): string | undefined {
  return g === "de" || g === "het" ? g : undefined;
}

function SuggestBody({
  form,
  query,
  article,
  pos,
  gloss,
  compound,
  inDeck,
  via,
  more = 0,
}: {
  form: string;
  query: string;
  article?: string;
  pos?: Pos;
  gloss: string;
  compound?: boolean;
  inDeck?: boolean;
  /** The inflected form that led here ("liep" → lopen). */
  via?: string;
  more?: number;
}) {
  return (
    <>
      <span className="suggest__line">
        <span>
          {article && (
            <span className="suggest__article" lang="nl">
              {article}{" "}
            </span>
          )}
          <span className="suggest__word" lang="nl">
            <Highlight form={form} query={via ? form : query} />
          </span>
          {via && (
            <span className="suggest__via" lang="nl">
              {" "}
              ← {via}
            </span>
          )}
        </span>
        {pos && <PosPill pos={pos} />}
        {compound && <span className="suggest__tag">Compound</span>}
        {inDeck && <span className="suggest__tag suggest__tag--deck">In your deck</span>}
      </span>
      {gloss && (
        <span className="suggest__gloss" lang="en">
          {gloss}
          {more > 0 && <span className="suggest__more-count"> +{more} more</span>}
        </span>
      )}
    </>
  );
}

/* AddChoice — the fork the + button (and the empty dashboard's "Add your
   first word") now opens onto, instead of dropping straight into the search
   field.

   There are two genuinely different ways a word gets into the deck — you know
   the word and go looking for it, or you're reading something and meet a word
   you don't know — and only the first was ever on the surface. Add-from-text
   existed but sat behind a line inside Capture, which meant the reading route
   was only found by people who had already started down the typing one.

   Rows rather than two stacked buttons: each way needs a line saying what it
   asks of you, which a button label can't carry. */
import { Appbar } from "../components/Appbar";
import { SearchIcon } from "../components/icons";
import { Book5, ChevronBackward } from "../icons";

export function AddChoice({
  onSingleWord,
  onFullSentence,
  onBack,
}: {
  /** A word you can name — the dictionary search (Capture). */
  onSingleWord: () => void;
  /** Text you're reading — paste it and tap words out of it (AddFromText). */
  onFullSentence: () => void;
  onBack: () => void;
}) {
  return (
    <div className="screen">
      <Appbar title="Add a word" onBack={onBack} />

      <div className="screen__body gutter" style={{ paddingTop: 16, paddingBottom: 24 }}>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.55, margin: "0 0 18px" }}>
          Two ways in, depending on where you met the word.
        </p>

        <div className="addchoice">
          <button className="addchoice__option" onClick={onSingleWord}>
            <span className="addchoice__icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <span className="addchoice__text">
              <span className="addchoice__title">A single word</span>
              <span className="addchoice__desc">
                Look it up in the dictionary and add it to your deck.
              </span>
            </span>
            {/* No forward chevron in the exported Material set — the back one,
                turned around (see .addchoice__chevron). */}
            <ChevronBackward className="addchoice__chevron" size={20} />
          </button>

          <button className="addchoice__option" onClick={onFullSentence}>
            <span className="addchoice__icon" aria-hidden="true">
              <Book5 size={19} />
            </span>
            <span className="addchoice__text">
              <span className="addchoice__title">A full sentence</span>
              <span className="addchoice__desc">
                Paste something you&rsquo;re reading, then tap the words you don&rsquo;t know.
              </span>
            </span>
            <ChevronBackward className="addchoice__chevron" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

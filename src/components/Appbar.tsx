/* Appbar — the shared screen header (Figma 250:2597): a title row with
   optional back/close buttons, and an optional search field below it. The
   search slot is off unless a `search` prop is passed, so screens that only
   need a title stay unchanged. `divider` draws the hairline that appears
   once there's body content beneath. */
import type { Ref } from "react";
import { IconButton } from "./IconButton";
import { SearchIcon } from "./icons";
import { Close } from "../icons";

export type AppbarSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible name for the field — placeholder text disappears once
   *  typing starts and isn't a reliable name for assistive tech, so this is
   *  required rather than falling back to `placeholder` silently. */
  ariaLabel: string;
  autoFocus?: boolean;
  /** Lets the screen refocus the field — e.g. ready for the next word. */
  inputRef?: Ref<HTMLInputElement>;
  /** Enter key — e.g. "look this up online anyway". */
  onSubmit?: () => void;
};

export function Appbar({
  title,
  onBack,
  onClose,
  divider = false,
  search,
}: {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
  divider?: boolean;
  search?: AppbarSearch;
}) {
  return (
    <header className={`appbar${divider ? " appbar--divider" : ""}`}>
      <div className="appbar__row">
        {onBack && <IconButton action="back" onClick={onBack} aria-label="Back" />}
        <h1 className="appbar__title title-serif">{title}</h1>
        {onClose ? (
          <IconButton action="close" onClick={onClose} aria-label="Close" />
        ) : (
          // Keeps the title optically centred against a lone left button.
          onBack && <span className="appbar__spacer" aria-hidden="true" />
        )}
      </div>

      {search && (
        <form
          className={`appbar__search${search.value ? " appbar__search--active" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            search.onSubmit?.();
          }}
        >
          <SearchIcon />
          <input
            ref={search.inputRef}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.ariaLabel}
            autoFocus={search.autoFocus}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {search.value && (
            <button
              type="button"
              className="appbar__clear"
              onClick={() => search.onChange("")}
              aria-label="Clear search"
            >
              <Close size={20} />
            </button>
          )}
        </form>
      )}
    </header>
  );
}

/* SearchField — the rounded search input with a clear button (Figma
   250:2597's search slot). Used by the Appbar's search row, and on its own
   where a screen has no app bar of its own, like onboarding's
   "add your first words". */
import type { Ref } from "react";
import { SearchIcon } from "./icons";
import { Close } from "../icons";

export type SearchFieldProps = {
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

export function SearchField({ value, onChange, placeholder, ariaLabel, autoFocus, inputRef, onSubmit }: SearchFieldProps) {
  return (
    <form
      className={`appbar__search${value ? " appbar__search--active" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <SearchIcon />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {value && (
        <button type="button" className="appbar__clear" onClick={() => onChange("")} aria-label="Clear search">
          <Close size={20} />
        </button>
      )}
    </form>
  );
}

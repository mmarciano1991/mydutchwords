/* Appbar — the shared screen header (Figma 250:2597): a title row with
   optional back/close/edit buttons, and an optional search field below it. The
   search slot is off unless a `search` prop is passed, so screens that only
   need a title stay unchanged. `divider` draws the hairline that appears
   once there's body content beneath.

   `floating` lifts it out of the layout onto a top Dock: the body scrolls up
   under it and fades out behind it. The screen must be a `.screen` with the
   Appbar and its `.screen__body` as direct children.

   Passing `progress` switches to the Type=Progress variant (Figma 375:1929),
   used by focused flows like Practice: close button and progress bar on the
   top row, the title centred beneath them. */
import { IconButton } from "./IconButton";
import { Dock } from "./Dock";
import { SearchField, type SearchFieldProps } from "./SearchField";

export type AppbarSearch = SearchFieldProps;

export type AppbarProgress = {
  value: number;
  max: number;
  /** Spoken in place of the bare numbers, e.g. "3 of 9 words done". */
  label: string;
};

export function Appbar({
  title,
  onBack,
  onClose,
  onEdit,
  divider = false,
  search,
  progress,
  floating = false,
  closeLabel = "Close",
}: {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
  /** Trailing wrench — opens wherever this screen's settings are changed. */
  onEdit?: () => void;
  divider?: boolean;
  search?: AppbarSearch;
  progress?: AppbarProgress;
  /** Float over the body on a fade-and-blur (the Progress variant always does). */
  floating?: boolean;
  closeLabel?: string;
}) {
  if (progress) {
    const pct = progress.max > 0 ? Math.min(100, (progress.value / progress.max) * 100) : 0;
    return (
      // Floats over the body on a fade-and-blur, so content scrolls up under it.
      <Dock edge="top" as="header" className="appbar appbar--progress">
        <div className="appbar__row">
          {onClose && <IconButton action="close" onClick={onClose} aria-label={closeLabel} />}
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={progress.value}
            aria-valuemin={0}
            aria-valuemax={progress.max}
            aria-valuetext={progress.label}
          >
            <div className="progress__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <h1 className="appbar__title title-serif">{title}</h1>
      </Dock>
    );
  }

  const className = `appbar${divider ? " appbar--divider" : ""}`;
  const content = (
    <>
      <div className="appbar__row">
        {onBack && <IconButton action="back" onClick={onBack} aria-label="Back" />}
        <h1 className="appbar__title title-serif">{title}</h1>
        {onClose ? (
          <IconButton action="close" onClick={onClose} aria-label={closeLabel} />
        ) : onEdit ? (
          <IconButton action="edit" onClick={onEdit} aria-label="Edit" />
        ) : (
          // Keeps the title optically centred against a lone left button.
          onBack && <span className="appbar__spacer" aria-hidden="true" />
        )}
      </div>

      {search && <SearchField {...search} />}
    </>
  );

  return floating ? (
    <Dock edge="top" as="header" className={className}>
      {content}
    </Dock>
  ) : (
    <header className={className}>{content}</header>
  );
}

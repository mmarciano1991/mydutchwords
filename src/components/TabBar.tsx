/* Bottom navigation (Figma 251:3389) — a floating pill holding the three
   tabs, with an optional FAB beside it that opens the Add-a-word flow. The
   FAB is switched off on screens where adding a word isn't the next thing
   the user would want (Settings).

   It stays mounted either way so showing/hiding animates: the FAB collapses
   its own width and the pill, being flex:1, grows into the space it frees.
   Hidden, it's inert — untabbable and hidden from assistive tech. */
import type { ComponentType } from "react";
import { Add, Book5, Build, Home, type IconProps } from "../icons";

export type Tab = "dashboard" | "browse" | "settings";

export function TabBar({
  active,
  onChange,
  onAddWord,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  /** Omit to hide the FAB. Receives the button, so the Add-a-word screen
   *  can expand out of it. */
  onAddWord?: (origin: HTMLElement) => void;
}) {
  const item = (tab: Tab, label: string, Icon: ComponentType<IconProps>) => {
    const isActive = active === tab;
    return (
      <button
        className={`tab${isActive ? " tab--active" : ""}`}
        onClick={() => onChange(tab)}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="bottomnav">
      <nav className="bottomnav__pill">
        {item("dashboard", "Home", Home)}
        {item("browse", "Deck", Book5)}
        {item("settings", "Settings", Build)}
      </nav>
      <button
        className={`fab${onAddWord ? "" : " fab--hidden"}`}
        onClick={(e) => onAddWord?.(e.currentTarget)}
        aria-label="Add a word"
        aria-hidden={onAddWord ? undefined : true}
        tabIndex={onAddWord ? undefined : -1}
      >
        <Add />
      </button>
    </div>
  );
}

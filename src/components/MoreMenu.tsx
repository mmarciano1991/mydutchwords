/* MoreMenu — the ⋮ menu on a deck card (Figma dictionary_card 104:161).

   Menu-button pattern: the ⋮ button opens a menu of actions placed next to
   it and kept inside the viewport; focus moves to the first action, ↑ ↓
   move between them, Esc closes and returns focus to the button, and a tap
   outside closes it. Choosing an action closes it first. The ⋮ button is a
   sibling of the card's own button — never a button inside a button — so
   opening the menu never activates the card. */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { MoreVert } from "../icons";

export interface MenuAction {
  label: string;
  onSelect: () => void;
  tone?: "danger";
}

export function MoreMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  // Inside the viewport: open upward when there's no room below.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const viewport = window.visualViewport?.height ?? window.innerHeight;
    setPlacement(button.bottom + menu.height + 8 > viewport && button.top > menu.height + 8 ? "above" : "below");
    menuRef.current.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function onMenuKey(e: KeyboardEvent) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div className="more-menu" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn icon-btn--ghost more-menu__button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <MoreVert />
      </button>
      {open && (
        <ul ref={menuRef} id={menuId} role="menu" aria-label={label} className={`more-menu__list more-menu__list--${placement}`} onKeyDown={onMenuKey}>
          {actions.map((a) => (
            <li key={a.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`more-menu__item${a.tone === "danger" ? " more-menu__item--danger" : ""}`}
                onClick={() => {
                  close();
                  a.onSelect();
                }}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

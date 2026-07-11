import type { ComponentType } from "react";
import { Book5, Build, Home, type IconProps } from "../icons";

export type Tab = "dashboard" | "browse" | "settings";

export function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
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
    <nav className="tabbar">
      {item("dashboard", "Home", Home)}
      {item("browse", "Deck", Book5)}
      {item("settings", "About", Build)}
    </nav>
  );
}

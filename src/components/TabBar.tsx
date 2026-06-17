import { BookIcon, GearIcon, HomeIcon, ListIcon } from "./icons";

export type Tab = "dashboard" | "browse" | "deck" | "settings";

export function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const item = (tab: Tab, label: string, icon: (c: string) => JSX.Element) => {
    const isActive = active === tab;
    const color = isActive ? "#1B4079" : "#9AA1AF";
    return (
      <button
        className={`tab${isActive ? " tab--active" : ""}`}
        onClick={() => onChange(tab)}
        aria-current={isActive ? "page" : undefined}
      >
        {icon(color)}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <nav className="tabbar">
      {item("dashboard", "Home", (c) => <HomeIcon color={c} />)}
      {item("browse", "Dictionary", (c) => <BookIcon color={c} />)}
      {item("deck", "Words", (c) => <ListIcon color={c} />)}
      {item("settings", "About", (c) => <GearIcon color={c} />)}
    </nav>
  );
}

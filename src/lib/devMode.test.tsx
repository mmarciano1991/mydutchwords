// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { isAdmin } from "./devMode";
import { Settings } from "../screens/Settings";
import { newHabit } from "./habit";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  },
});

describe("isAdmin", () => {
  it("is true only for app_metadata.role = admin", () => {
    expect(isAdmin({ app_metadata: { role: "admin" } })).toBe(true);
    expect(isAdmin({ app_metadata: {} })).toBe(false);
    expect(isAdmin({ app_metadata: { role: "user" } })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("Settings › Developer", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    store.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderSettings = (admin: boolean, onPreview = vi.fn()) =>
    act(() =>
      root.render(
        <Settings
          deckCount={3}
          configured
          email="me@example.com"
          habit={newHabit({ commitment: "espresso", time: "08:00" }, new Date())}
          onHabitChange={() => {}}
          onSignOut={async () => true}
          isAdmin={admin}
          onPreviewOnboarding={onPreview}
        />
      )
    );

  it("is hidden from non-admins", () => {
    renderSettings(false);
    expect(container.textContent).not.toContain("Developer");
  });

  it("shows dev mode to admins, and the onboarding preview once it's on", () => {
    const onPreview = vi.fn();
    renderSettings(true, onPreview);
    expect(container.textContent).toContain("Dev mode");
    expect(container.textContent).not.toContain("Preview onboarding");
    const toggles = container.querySelectorAll<HTMLInputElement>("input.toggle");
    const toggle = toggles[toggles.length - 1];
    act(() => toggle.click());
    expect(store.get("woordkast.devMode")).toBe("1");
    const btn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("new user"))!;
    act(() => btn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onPreview).toHaveBeenCalledWith("new");
  });
});

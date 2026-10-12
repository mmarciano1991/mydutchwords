/* Small helpers for the component tests: a React root in jsdom, clicks,
   typing, and letting promises settle. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* jsdom 30 under vitest 2 ships no localStorage; the app uses it. */
if (typeof globalThis.localStorage === "undefined") {
  let store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store = new Map();
    },
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: shim, configurable: true });
}

export interface Mounted {
  container: HTMLDivElement;
  root: Root;
  text: () => string;
  unmount: () => void;
}

export function mount(ui: ReactElement): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    root,
    text: () => container.textContent ?? "",
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export function clickEl(el: Element | null) {
  if (!el) throw new Error("nothing to click");
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export function button(container: Element, label: string): HTMLButtonElement {
  const b = [...container.querySelectorAll("button")].find(
    (x) => x.textContent?.trim() === label || x.getAttribute("aria-label") === label || x.textContent?.includes(label)
  );
  if (!b) throw new Error(`no button "${label}" in: ${container.textContent}`);
  return b as HTMLButtonElement;
}

export function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });
}

export async function flush(rounds = 10) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

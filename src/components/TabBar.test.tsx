// @vitest-environment jsdom
/* Guards the bottom nav's travelling blob (Figma 251:3389).

   This exists because the animation has died silently twice. First the flight
   effect ran once on a render where the active index had changed but the
   measured rect hadn't caught up, and that stale pass claimed the hop, so the
   real one saw nothing to do. Then, on Settings, the FAB collapse resized the
   pill mid-flight and pre-baked keyframes animated towards a slot that had
   moved. Neither failed loudly; the blob just stopped being fluid.

   So these tests drive the real frame loop and read the blob's own geometry. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TabBar, type Tab } from "./TabBar";

// React 18 needs this to accept act() outside a test renderer.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAB_W = 82;
const ORDER = ["Home", "Deck", "Settings"];
/* Mutable, so a test can widen the pill the way the FAB collapsing does. */
let tabW = TAB_W;
let fireResize: (() => void) | null = null;

let container: HTMLDivElement;
let root: Root;
let frames: FrameRequestCallback[] = [];

/** Run the queued frame callbacks, repeatedly — each tick schedules the next. */
function runFrames(count: number) {
  act(() => {
    for (let i = 0; i < count; i++) {
      const queued = frames;
      frames = [];
      queued.forEach((cb) => cb(i * 16));
    }
  });
}

function glass() {
  return container.querySelector<HTMLElement>(".bottomnav__glass")!;
}
const left = () => parseFloat(glass().style.left);
const width = () => parseFloat(glass().style.width);

/* jsdom does no layout, so every rect would be zero and the blob would never
   move. Stand in a three-slot pill and report each tab at its own offset. */
function installLayout() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const label = this.querySelector(".tab__label")?.textContent ?? "";
    const isTab = this.classList.contains("tab");
    const x = isTab ? Math.max(0, ORDER.indexOf(label)) * tabW : 0;
    return {
      left: x, width: isTab ? tabW : tabW * 3, top: 0, height: 62,
      right: 0, bottom: 0, x, y: 0, toJSON: () => ({}),
    } as DOMRect;
  };
}

beforeEach(() => {
  frames = [];
  tabW = TAB_W;
  fireResize = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        fireResize = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  installLayout();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(active: Tab) {
  act(() => {
    root.render(<TabBar active={active} onChange={() => {}} />);
  });
}

describe("bottom nav blob", () => {
  it("starts on its slot without animating", () => {
    render("dashboard");
    expect(left()).toBeCloseTo(0, 1);
    expect(width()).toBeCloseTo(TAB_W, 1);
    expect(frames.length, "first paint should schedule no frames").toBe(0);
  });

  it("travels to the tapped tab and settles there", () => {
    render("dashboard");
    render("browse");
    expect(frames.length, "the blob was handed no frames — it teleported").toBeGreaterThan(0);

    runFrames(200);
    expect(left()).toBeCloseTo(TAB_W, 1);
    expect(width()).toBeCloseTo(TAB_W, 1);
  });

  it("stretches on the way, then gathers back", () => {
    render("dashboard");
    render("settings");

    let peak = 0;
    for (let i = 0; i < 200; i++) {
      runFrames(1);
      peak = Math.max(peak, width());
    }
    expect(peak, "the blob never elongated").toBeGreaterThan(TAB_W + 10);
    expect(width()).toBeCloseTo(TAB_W, 1);
    expect(left()).toBeCloseTo(TAB_W * 2, 1);
  });

  it("travels leftwards too", () => {
    render("settings");
    render("dashboard");

    let peak = 0;
    for (let i = 0; i < 200; i++) {
      runFrames(1);
      peak = Math.max(peak, width());
    }
    expect(peak).toBeGreaterThan(TAB_W + 10);
    expect(left()).toBeCloseTo(0, 1);
  });

  it("never lets the blob invert or collapse mid-flight", () => {
    render("dashboard");
    render("settings");
    for (let i = 0; i < 200; i++) {
      runFrames(1);
      expect(width()).toBeGreaterThan(0);
    }
  });

  /* The reported bug: tapping Settings hides the FAB, so the pill spends 260ms
     growing while the blob is still in the air. Pre-baked keyframes aimed at
     the slot's old position and the blob stalled. */
  it("keeps flowing when the pill grows mid-flight", () => {
    render("dashboard");
    render("settings");
    runFrames(6);

    const midFlight = left();
    expect(midFlight).toBeGreaterThan(0);

    // The FAB has collapsed: every slot is wider, so Settings has moved right.
    tabW = 96;
    act(() => fireResize?.());

    let stalled = 0;
    let previous = left();
    for (let i = 0; i < 300; i++) {
      runFrames(1);
      if (Math.abs(left() - previous) < 0.01 && Math.abs(left() - tabW * 2) > 1) stalled++;
      previous = left();
    }

    expect(stalled, "the blob froze instead of chasing the moved slot").toBe(0);
    expect(left()).toBeCloseTo(tabW * 2, 1);
    expect(width()).toBeCloseTo(tabW, 1);
  });

  it("re-rendering the same tab does not re-fly", () => {
    render("browse");
    frames = [];
    render("browse");
    expect(frames.length).toBe(0);
  });
});

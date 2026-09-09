/* Bottom navigation (Figma 251:3389) — a floating pill holding the three
   tabs, with an optional FAB beside it that opens the Add-a-word flow. The
   FAB is switched off on screens where adding a word isn't the next thing
   the user would want (Settings).

   It stays mounted either way so showing/hiding animates: the FAB collapses
   its own width and the pill, being flex:1, grows into the space it frees.
   Hidden, it's inert — untabbable and hidden from assistive tech.

   The active tab is a cobalt pill that travels between slots rather than
   being repainted in place. It's one element measured against the live tab
   rects, so it stays correct when the pill resizes (the FAB collapsing) or
   when label widths shift as fonts load. */
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Add, Book5, Build, Home, type IconProps } from "../icons";

export type Tab = "dashboard" | "browse" | "settings";

const TABS: { id: Tab; label: string; Icon: ComponentType<IconProps> }[] = [
  { id: "dashboard", label: "Home", Icon: Home },
  { id: "browse", label: "Deck", Icon: Book5 },
  { id: "settings", label: "Settings", Icon: Build },
];

/* Liquid flight. Each edge of the blob is carried by its own damped spring,
   and the blob is whatever lies between them. The edge facing the destination
   is sprung stiffly and leaves first; the trailing edge is slack and lags, so
   the shape elongates mid-flight and gathers back up as the two converge.

   Springs rather than a bezier because that is what "natural" means physically:
   the blob is pulled to its target and damped, so it eases out of its own
   accord instead of tracing a curve someone drew. ~0.9 damping — just short of
   critical, so it settles without a bounce.

   Integrated live per frame rather than baked into keyframes, because the
   target moves: tapping Settings hides the FAB, and the pill spends 260ms
   growing into the freed space. Pre-baked keyframes would animate towards
   where the slot used to be and fight the resize. A spring chasing a live
   target just follows it.

   Scaling the blob instead would squash its 999px caps into ellipses;
   animating the edges keeps them perfectly round the whole way. */
const SPRING_LEAD = 240; // stiffness of the edge facing the destination
const SPRING_TRAIL = 100; // …and of the one dragging behind it
const DAMPING_RATIO = 0.9; // <1 overshoots, 1 is critical; 0.9 settles softly
const MAX_THIN = 3; // px the blob narrows as it stretches, like a drawn droplet
const STEP = 1 / 60; // fixed timestep, so the feel doesn't vary with framerate
const SETTLE_PX = 0.05;
const SETTLE_VEL = 1.5;

const dampingFor = (stiffness: number) => 2 * DAMPING_RATIO * Math.sqrt(stiffness);

/** One spring step. Returns the new position and velocity. */
function advance(x: number, v: number, to: number, stiffness: number) {
  const nv = v + (-stiffness * (x - to) - dampingFor(stiffness) * v) * STEP;
  return { x: x + nv * STEP, v: nv };
}

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
  const pillRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const glassRef = useRef<HTMLSpanElement | null>(null);
  const sheenRef = useRef<HTMLSpanElement | null>(null);
  const flownIndex = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  // Live spring state for the blob's two edges, and where they're heading.
  const edges = useRef({ left: 0, right: 0, vLeft: 0, vRight: 0 });
  const target = useRef({ left: 0, right: 0 });
  const stiffness = useRef({ left: SPRING_LEAD, right: SPRING_LEAD });
  const rest = useRef({ height: 48, top: 6 });

  // The index travels with the geometry. Keeping them in one piece of state
  // is what stops a render where activeIndex has changed but the rect hasn't
  // yet from being mistaken for a completed hop.
  const [box, setBox] = useState<{ x: number; w: number; index: number } | null>(null);
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === active));

  // Measure the active slot against the pill, and keep measuring while the
  // pill's own width animates (the FAB collapsing) so the glass tracks it.
  useLayoutEffect(() => {
    const measure = () => {
      const pill = pillRef.current;
      const tab = tabRefs.current[activeIndex];
      if (!pill || !tab) return;
      const p = pill.getBoundingClientRect();
      const t = tab.getBoundingClientRect();
      // The glass is absolutely positioned, so its offsets resolve against the
      // pill's padding box — measure from inside the border, not the edge.
      // clientLeft is the border width outright; parsing the computed string
      // would mean trusting how the engine resolves the `medium` keyword.
      const x = t.left - p.left - pill.clientLeft;
      setBox((prev) =>
        prev && prev.x === x && prev.w === t.width && prev.index === activeIndex
          ? prev
          : { x, w: t.width, index: activeIndex },
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (pillRef.current) ro.observe(pillRef.current);
    tabRefs.current.forEach((el) => el && ro.observe(el));
    // Label widths move when the webfont swaps in.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [activeIndex]);

  // Resting geometry lives in CSS; read it once, before anything is written
  // inline, so the two can't drift apart.
  useLayoutEffect(() => {
    const el = glassRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    rest.current = {
      height: parseFloat(cs.height) || rest.current.height,
      top: parseFloat(cs.top) || rest.current.top,
    };
  }, []);

  useLayoutEffect(() => {
    const el = glassRef.current;
    if (!el || !box) return;

    const paint = () => {
      const { left, right } = edges.current;
      const width = Math.max(right - left, 0);
      const resting = target.current.right - target.current.left;
      // Narrows as it draws out, the way a stretched droplet thins.
      const thin = Math.min(MAX_THIN, Math.max(0, width - resting) / 12);
      el.style.left = `${left}px`;
      el.style.width = `${width}px`;
      el.style.height = `${rest.current.height - thin}px`;
      el.style.top = `${rest.current.top + thin / 2}px`;
    };

    const snap = () => {
      edges.current = {
        left: target.current.left,
        right: target.current.right,
        vLeft: 0,
        vRight: 0,
      };
      paint();
    };

    target.current = { left: box.x, right: box.x + box.w };

    const first = flownIndex.current === null;
    const changedTab = flownIndex.current !== box.index;
    flownIndex.current = box.index;

    // First paint starts where it starts. A pure geometry change while the
    // blob is at rest — the FAB collapsing with no tab change — is tracked
    // exactly, not sprung, so it stays glued to its slot.
    if (first || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      snap();
      return;
    }
    if (!changedTab && rafRef.current === null) {
      snap();
      return;
    }

    if (changedTab) {
      const goingRight = target.current.left > edges.current.left;
      stiffness.current = {
        left: goingRight ? SPRING_TRAIL : SPRING_LEAD,
        right: goingRight ? SPRING_LEAD : SPRING_TRAIL,
      };

      const dir = goingRight ? 1 : -1;
      sheenRef.current?.animate?.(
        [
          { transform: `translateX(${-60 * dir}%)`, opacity: 0 },
          { opacity: 0.28, offset: 0.45 },
          { transform: `translateX(${60 * dir}%)`, opacity: 0 },
        ],
        { duration: 560, easing: "linear" },
      );
    }

    // Already in flight: the targets above have moved, and the running loop
    // will simply chase them. Nothing else to do.
    if (rafRef.current !== null) return;

    const tick = () => {
      const e = edges.current;
      const t = target.current;
      const l = advance(e.left, e.vLeft, t.left, stiffness.current.left);
      const r = advance(e.right, e.vRight, t.right, stiffness.current.right);
      edges.current = { left: l.x, right: r.x, vLeft: l.v, vRight: r.v };
      paint();

      const settled =
        Math.abs(l.x - t.left) < SETTLE_PX &&
        Math.abs(r.x - t.right) < SETTLE_PX &&
        Math.abs(l.v) < SETTLE_VEL &&
        Math.abs(r.v) < SETTLE_VEL;

      if (settled) {
        rafRef.current = null;
        snap();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [box]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div className="bottomnav">
      <nav className="bottomnav__pill" ref={pillRef}>
        <span className="bottomnav__glass" ref={glassRef} aria-hidden="true">
          <span className="bottomnav__sheen" ref={sheenRef} />
        </span>
        {TABS.map(({ id, label, Icon }, i) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              className={`tab${isActive ? " tab--active" : ""}`}
              onClick={() => onChange(id)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="tab__icon">
                <Icon />
              </span>
              <span className="tab__label">{label}</span>
            </button>
          );
        })}
      </nav>
      <button
        className={`fab${onAddWord ? "" : " fab--hidden"}`}
        onClick={(e) => onAddWord?.(e.currentTarget)}
        aria-label="Add a word to your deck"
        aria-hidden={onAddWord ? undefined : true}
        tabIndex={onAddWord ? undefined : -1}
      >
        <Add />
      </button>
    </div>
  );
}

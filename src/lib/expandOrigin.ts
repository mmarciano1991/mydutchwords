/* Geometry for the container-transform open animation (Material's FAB →
   full-screen pattern): the incoming screen is revealed by a circle that
   grows from the button that opened it.

   Coordinates are relative to the phone frame, which is also the box the
   incoming screen fills, so they drop straight into `clip-path: circle()`. */

export interface ExpandOrigin {
  /** Circle centre within the phone frame. */
  x: number;
  y: number;
  /** Radius that just covers the frame from that centre. */
  r: number;
}

/** Null when the frame can't be measured — callers then skip the animation. */
export function expandOriginFrom(el: HTMLElement): ExpandOrigin | null {
  const frame = el.closest(".phone");
  if (!frame) return null;

  const button = el.getBoundingClientRect();
  const box = frame.getBoundingClientRect();
  if (!box.width || !box.height) return null;

  const x = button.left + button.width / 2 - box.left;
  const y = button.top + button.height / 2 - box.top;

  // Farthest corner — anything closer would leave a gap at full expansion.
  return {
    x,
    y,
    r: Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y)),
  };
}

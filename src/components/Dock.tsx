/* Dock — a screen's bottom actions, floating over the scrolling body with the
   same progressive blur as the tab bar (see .dock in app.css), instead of
   sitting on a band of solid canvas.

   It must be a direct child of `.screen`. Its height is published to the
   screen as --dock-h so the body can reserve that much room at its end and
   its last row scroll clear of the buttons.

   edge="top" pins it to the top instead (a header the body scrolls under),
   fading the other way; its height goes out as --dock-top-h. */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function Dock({
  className,
  style,
  edge = "bottom",
  as: Tag = "div",
  children,
}: {
  className?: string;
  style?: CSSProperties;
  edge?: "top" | "bottom";
  as?: "div" | "header";
  children: ReactNode;
}) {
  const heightVar = edge === "top" ? "--dock-top-h" : "--dock-h";
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const screen = el?.parentElement;
    if (!el || !screen) return;
    const publish = () => screen.style.setProperty(heightVar, `${el.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      screen.style.removeProperty(heightVar);
    };
  }, [heightVar]);

  return (
    <Tag
      ref={ref}
      className={`dock${edge === "top" ? " dock--top" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {children}
    </Tag>
  );
}

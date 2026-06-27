/* ──────────────────────────────────────────────────────────────────────────
   IconButton — merged from the former IconButton + AddButton (Figma node 61:22).
   Actions: add | close | remove.  States: default · pressed (CSS :active) ·
   success (add → check on a solid-green chip). 38×38, radius-input, all colours
   driven by design tokens. See src/styles/app.css → ".icon-btn".
   ────────────────────────────────────────────────────────────────────────── */
import type { ButtonHTMLAttributes } from "react";
import { Add, Check, Close, Remove } from "../icons";

export type IconButtonAction = "add" | "close" | "remove";

type IconButtonProps = {
  action: IconButtonAction;
  /** add-only: shows the success (added) state — solid green with a check. */
  success?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButton({
  action,
  success = false,
  className,
  ...rest
}: IconButtonProps) {
  const isSuccess = success && action === "add";
  const Glyph = isSuccess
    ? Check
    : action === "add"
      ? Add
      : action === "close"
        ? Close
        : Remove;

  const classes = [
    "icon-btn",
    `icon-btn--${action}`,
    isSuccess ? "icon-btn--success" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} {...rest}>
      <Glyph />
    </button>
  );
}

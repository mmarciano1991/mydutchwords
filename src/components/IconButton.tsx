/* ──────────────────────────────────────────────────────────────────────────
   IconButton — merged from the former IconButton + AddButton (Figma node 61:22).
   Actions: add | close | remove | expand.  States: default · pressed (CSS
   :active) · success (add → check on a solid-green chip).
   Variants (`variant`): secondary (default — surface card + cool border) and
   no-background (transparent, tints on press). 38×38, radius-input; all colours
   driven by design tokens. See src/styles/app.css → ".icon-btn".
   ────────────────────────────────────────────────────────────────────────── */
import type { ButtonHTMLAttributes } from "react";
import { Add, Check, ChevronDown, Close, Remove } from "../icons";

export type IconButtonAction = "add" | "close" | "remove" | "expand";
export type IconButtonVariant = "secondary" | "no-background";

type IconButtonProps = {
  action: IconButtonAction;
  /** add-only: shows the success (added) state — solid green with a check. */
  success?: boolean;
  variant?: IconButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const GLYPH = {
  add: Add,
  close: Close,
  remove: Remove,
  expand: ChevronDown,
} as const;

export function IconButton({
  action,
  success = false,
  variant = "secondary",
  className,
  ...rest
}: IconButtonProps) {
  const isSuccess = success && action === "add";
  const Glyph = isSuccess ? Check : GLYPH[action];

  const classes = [
    "icon-btn",
    `icon-btn--${action}`,
    variant === "no-background" ? "icon-btn--ghost" : "",
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

/* ──────────────────────────────────────────────────────────────────────────
   Local icon library — Material Symbols, exported from the Figma design system
   (page "Icons", node 78:177). Each icon is a 24×24 React component that paints
   with `currentColor`, so the consumer controls the colour via CSS `color`.
   Do not edit the path data by hand — re-export from Figma if the icons change.
   ────────────────────────────────────────────────────────────────────────── */
import type { ReactNode, SVGProps } from "react";

export type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

function Icon({
  size = 24,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function Close(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z" />
    </Icon>
  );
}

export function Add(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 13H5V11H11V5H13V11H19V13H13V19H11V13Z" />
    </Icon>
  );
}

export function Remove(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 13V11H19V13H5Z" />
    </Icon>
  );
}

export function Check(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.55 18L3.85 12.3L5.275 10.875L9.55 15.15L18.725 5.975L20.15 7.4L9.55 18Z" />
    </Icon>
  );
}

export function Home(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 21V9L12 3L20 9V21H14V14H10V21H4Z" />
    </Icon>
  );
}

export function Book5(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.75 22C6 22 5.35417 21.7458 4.8125 21.2375C4.27083 20.7292 4 20.1 4 19.35V5.4C4 4.76667 4.19583 4.2 4.5875 3.7C4.97917 3.2 5.49167 2.88334 6.125 2.75L16 0.800003V16.8L6.525 18.7C6.375 18.7333 6.25 18.8125 6.15 18.9375C6.05 19.0625 6 19.2 6 19.35C6 19.5333 6.075 19.6875 6.225 19.8125C6.375 19.9375 6.55 20 6.75 20H18V4H20V22H6.75ZM7 16.575L9 16.175V4.225L7 4.625V16.575Z" />
    </Icon>
  );
}

export function Build(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17.15 20.7L11.1 14.6C10.7667 14.7333 10.4292 14.8333 10.0875 14.9C9.74583 14.9667 9.38333 15 9 15C7.33333 15 5.91667 14.4167 4.75 13.25C3.58333 12.0833 3 10.6667 3 9C3 8.4 3.08333 7.82917 3.25 7.2875C3.41667 6.74583 3.65 6.23333 3.95 5.75L7.6 9.4L9.4 7.6L5.75 3.95C6.23333 3.65 6.74583 3.41667 7.2875 3.25C7.82917 3.08333 8.4 3 9 3C10.6667 3 12.0833 3.58333 13.25 4.75C14.4167 5.91667 15 7.33333 15 9C15 9.38333 14.9667 9.74583 14.9 10.0875C14.8333 10.4292 14.7333 10.7667 14.6 11.1L20.7 17.15C20.9 17.35 21 17.5917 21 17.875C21 18.1583 20.9 18.4 20.7 18.6L18.6 20.7C18.4 20.9 18.1583 21 17.875 21C17.5917 21 17.35 20.9 17.15 20.7Z" />
    </Icon>
  );
}

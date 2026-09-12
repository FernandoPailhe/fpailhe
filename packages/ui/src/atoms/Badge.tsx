import type { CSSProperties } from "react";

export interface BadgeProps {
  /** Código corto, 2–4 caracteres. */
  shortCode: string;
  /** Color de fondo (hex). */
  color: string;
  size?: "sm" | "lg";
  className?: string;
}

/** Chip circular con código corto sobre un color de fondo. */
export function Badge({ shortCode, color, size = "sm", className = "" }: BadgeProps) {
  const dimension = size === "lg" ? "h-[4.4rem] w-[4.4rem] text-[0.92rem]" : "h-10 w-10 text-[0.62rem]";

  const style: CSSProperties = {
    backgroundColor: color,
    backgroundImage:
      "radial-gradient(circle at 32% 26%, rgba(255,255,255,.55), rgba(255,255,255,0) 46%), " +
      "radial-gradient(circle at 72% 82%, rgba(0,0,0,.4), rgba(0,0,0,0) 62%)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,.16), 0 2px 6px rgba(0,0,0,.4)",
  };

  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-pill font-ui font-black tracking-wide text-white ${dimension} ${className}`}
      style={{ ...style, textShadow: "0 1px 2px rgba(0,0,0,.55)" }}
    >
      {shortCode}
    </span>
  );
}

import type { ReactNode } from "react";

export interface KickerProps {
  children: ReactNode;
  as?: "span" | "p";
  className?: string;
}

/** Etiqueta superior en mono, mayúsculas, tracking ancho. */
export function Kicker({ children, as: Component = "span", className = "" }: KickerProps) {
  return (
    <Component
      className={`font-mono text-xs uppercase tracking-[0.12em] text-ink-faint ${className}`}
    >
      {children}
    </Component>
  );
}

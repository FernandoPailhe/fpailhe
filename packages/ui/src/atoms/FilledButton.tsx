import type { ReactNode } from "react";

export interface FilledButtonProps {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * El único botón relleno del sitio — reservado para acciones reales
 * (ej. "Download PDF" en /cv), nunca para navegación.
 */
export function FilledButton({ onClick, children, className = "" }: FilledButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-ink px-5 py-2.5 font-ui text-sm font-semibold text-canvas transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      {children}
    </button>
  );
}

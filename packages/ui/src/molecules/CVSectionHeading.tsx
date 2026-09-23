import type { ReactNode } from "react";

export interface CVSectionHeadingProps {
  /** Ícono pequeño ya resuelto (SVG inline, ~14px). */
  icon: ReactNode;
  /** Se renderiza en uppercase con tracking amplio. */
  title: string;
}

/**
 * Heading de sección del CV: ícono dentro de un círculo con borde + título
 * en versalitas espaciadas. Mismo vocabulario en sidebar y columna principal —
 * es la pieza que sectoriza visualmente los bloques.
 */
export function CVSectionHeading({ icon, title }: CVSectionHeadingProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-ink-dim"
      >
        {icon}
      </span>
      <h2 className="font-ui text-xs font-semibold uppercase tracking-[0.2em] text-ink">
        {title}
      </h2>
    </div>
  );
}

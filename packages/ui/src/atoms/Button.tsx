import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost-gold" | "tab";
  active?: boolean;
}

const BASE =
  "inline-flex items-center gap-2 rounded-pill font-ui text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright disabled:cursor-default disabled:opacity-40";

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, (active?: boolean) => string> = {
  "ghost-gold": () => "border border-gold bg-transparent px-3 py-1.5 text-gold-bright hover:bg-gold-soft",
  tab: (active) =>
    active
      ? "border border-gold bg-gold-soft px-4 py-2.5 text-gold-bright"
      : "border border-line bg-surface px-4 py-2.5 text-ink-dim hover:border-ink-faint hover:text-ink",
};

/**
 * Clases del variant "tab", expuestas sueltas para poder aplicarlas a un
 * `<NavLink>` de React Router (no se puede anidar un `<button>` dentro del
 * `<a>` que renderiza NavLink) y mantener igual el estilo entre el tab-link
 * activo y los tabs deshabilitados (que sí son `<Button variant="tab">`).
 */
export function tabClasses(active?: boolean): string {
  return `${BASE} ${VARIANTS.tab(active)}`;
}

export function Button({ variant = "ghost-gold", active, className = "", ...rest }: ButtonProps) {
  const variantClass = VARIANTS[variant](active);
  return <button className={`${BASE} ${variantClass} ${className}`} {...rest} />;
}

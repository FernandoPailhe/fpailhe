export interface InitialsAvatarProps {
  /** Dos iniciales, ej. "FP". */
  initials: string;
  /** Tamaño base en píxeles (default: 220 para coincidir con la foto actual). */
  size?: number;
  className?: string;
}

/**
 * Monograma genérico con iniciales: fallback visual cuando la foto real
 * no existe o falla al cargar. Usa solo tokens del theme.
 */
export function InitialsAvatar({ initials, size = 220, className = "" }: InitialsAvatarProps) {
  return (
    <span
      className={`inline-flex aspect-square items-center justify-center border border-line bg-gold-soft font-display text-gold ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${initials} initials avatar`}
    >
      {initials}
    </span>
  );
}

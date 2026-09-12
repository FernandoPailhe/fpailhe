import { Badge } from "../atoms/Badge";

export interface TeamIdentityProps {
  name: string;
  shortCode: string;
  color: string;
  subtitle?: string;
  size?: "sm" | "lg";
  className?: string;
}

/** Badge + nombre (+ subtítulo opcional). Componente de identidad para listas y tarjetas. */
export function TeamIdentity({ name, shortCode, color, subtitle, size = "sm", className = "" }: TeamIdentityProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Badge shortCode={shortCode} color={color} size={size} />
      <div className="min-w-0">
        <strong className="block truncate font-ui text-sm font-bold text-ink">{name}</strong>
        {subtitle ? (
          <span className="block font-mono text-[0.66rem] tracking-wide text-ink-faint">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

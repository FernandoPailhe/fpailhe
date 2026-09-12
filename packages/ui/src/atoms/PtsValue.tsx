export interface PtsValueProps {
  /** Ya formateado, ej. "8,5" (ver `fmtNota` de @ferpa/data-model). */
  value: string;
  size?: "sm" | "lg";
}

export function PtsValue({ value, size = "sm" }: PtsValueProps) {
  const sizeClass = size === "lg" ? "text-2xl" : "text-base";
  return <span className={`font-mono font-bold text-ink ${sizeClass}`}>{value}</span>;
}

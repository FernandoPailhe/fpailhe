export interface StatPillProps {
  label: string;
  value: string;
}

/** Dato secundario en formato "etiqueta: valor", ideal para filas expandidas o tarjetas mobile. */
export function StatPill({ label, value }: StatPillProps) {
  return (
    <span className="rounded-md border border-line bg-surface-raised px-2 py-1.5 text-center font-mono text-xs text-ink-dim">
      <span className="text-ink-faint">{label}: </span>
      {value}
    </span>
  );
}

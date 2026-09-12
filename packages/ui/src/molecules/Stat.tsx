export interface StatProps {
  value: string;
  label: string;
  sublabel: string;
}

/** Celda de la franja de estadísticas: valor grande en mono + etiquetas. */
export function Stat({ value, label, sublabel }: StatProps) {
  return (
    <div className="bg-surface-raised px-5 py-6">
      <div className="font-mono text-[clamp(2rem,4vw,2.6rem)] font-semibold leading-none text-ink">
        {value}
      </div>
      <div className="mt-3 font-ui text-sm font-medium text-ink">{label}</div>
      <div className="mt-1 font-ui text-xs text-ink-dim">{sublabel}</div>
    </div>
  );
}

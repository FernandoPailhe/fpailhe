export interface SealMarkProps {
  /** Emoji o glifo central. */
  icon?: string;
  /** Monograma corto debajo del glifo, 2–4 caracteres. */
  monogram?: string;
}

/** Sello/emblema circular decorativo para usar en membretes o cabeceras. */
export function SealMark({ icon = "✦", monogram = "APP" }: SealMarkProps) {
  return (
    <div
      className="flex h-16 w-16 flex-none flex-col items-center justify-center gap-px rounded-pill border-[1.5px] border-gold bg-surface-raised"
      style={{
        backgroundImage: "radial-gradient(circle at 32% 26%, rgba(255,255,255,.14), rgba(255,255,255,0) 45%)",
        boxShadow: "0 0 0 4px var(--color-gold-soft), inset 0 0 0 1px var(--color-gold-soft)",
      }}
      aria-hidden="true"
    >
      <span className="text-base leading-none" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}>
        {icon}
      </span>
      <span className="font-mono text-[0.56rem] font-bold tracking-[0.12em] text-gold-bright">{monogram}</span>
    </div>
  );
}

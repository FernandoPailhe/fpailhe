export interface ComunicadoItem {
  label: string;
  value: string;
  /** Resalta el valor en dorado. */
  emphasis?: boolean;
}

export interface ComunicadoBoxProps {
  items: ComunicadoItem[];
}

/** Bloque de datos clave-valor, ideal para membretes o sidebars informativas. */
export function ComunicadoBox({ items }: ComunicadoBoxProps) {
  return (
    <div className="grid min-w-[9.5rem] flex-none gap-[0.32rem] border-l border-line pl-[1.1rem] text-right font-mono text-[0.7rem] text-ink-dim mobile:border-l-0 mobile:border-t mobile:pl-0 mobile:pt-[0.9rem] mobile:text-left">
      {items.map((item) => (
        <span key={item.label}>
          <strong className="block font-ui text-[0.66rem] font-bold uppercase tracking-wide text-ink">
            {item.label}
          </strong>{" "}
          <span className={item.emphasis ? "text-gold-bright" : undefined}>{item.value}</span>
        </span>
      ))}
    </div>
  );
}

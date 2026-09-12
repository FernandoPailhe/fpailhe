import type { WorkPanel } from "@ferpa/data-model";

export interface HowIWorkSectionProps {
  panels: WorkPanel[];
  closingNote: string;
}

/** Paneles numerados — mismo vocabulario de grilla que el timeline del CV. */
export function HowIWorkSection({ panels, closingNote }: HowIWorkSectionProps) {
  return (
    <section id="work" className="py-16">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">
        How I work
      </h2>
      <ol className="mt-6">
        {panels.map((panel, index) => (
          <li
            key={panel.heading}
            className="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-6 mobile:grid-cols-1 mobile:gap-2"
          >
            <span className="pt-1 font-mono text-xs text-ink-faint">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-medium text-ink">{panel.heading}</h3>
              <p className="mt-2 font-ui text-sm leading-relaxed text-ink-dim">{panel.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-[62ch] font-ui text-sm leading-relaxed text-ink-dim">
        {closingNote}
      </p>
    </section>
  );
}

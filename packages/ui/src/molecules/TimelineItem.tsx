import type { ReactNode } from "react";

export interface TimelineItemProps {
  dateRange: string;
  title: string;
  company: string;
  location?: string;
  bullets: string[];
  tech: string[];
  children?: ReactNode;
}

/**
 * Fila de timeline (CV): grilla `130px 1fr` en desktop, una columna en
 * mobile. La fecha va en mono/muted — mismo vocabulario que las filas
 * numeradas de "How I work".
 */
export function TimelineItem({
  dateRange,
  title,
  company,
  location,
  bullets,
  tech,
  children,
}: TimelineItemProps) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-6 mobile:grid-cols-1 mobile:gap-2">
      <div className="pt-1 font-mono text-xs leading-relaxed text-ink-faint">{dateRange}</div>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
        <p className="mt-0.5 font-ui text-sm text-ink-dim">
          {company}
          {location ? ` · ${location}` : ""}
        </p>
        {bullets.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-ink-faint">
            {bullets.map((bullet) => (
              <li key={bullet} className="font-ui text-sm leading-relaxed text-ink-dim">
                {bullet}
              </li>
            ))}
          </ul>
        ) : null}
        {tech.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tech.map((t) => (
              <span
                key={t}
                className="border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-dim"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

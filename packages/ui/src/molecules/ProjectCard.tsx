import { TextLink } from "../atoms/TextLink";

export interface ProjectCardProps {
  name: string;
  context?: string;
  tech: string[];
  description: string;
  status: "live" | "in-progress";
  link?: string;
}

/**
 * Tarjeta de proyecto. Pensada para grillas de hairline: el contenedor
 * externo usa `bg-line` + `gap-px` y cada card pinta su propio fondo.
 */
export function ProjectCard({ name, context, tech, description, status, link }: ProjectCardProps) {
  return (
    <article className="flex h-full flex-col bg-surface-raised p-5">
      <header>
        <h3 className="font-display text-lg font-medium text-ink">
          {link ? (
            <TextLink href={link} external>
              {name}
            </TextLink>
          ) : (
            name
          )}
        </h3>
        {context ? <p className="mt-1 font-mono text-xs text-ink-faint">{context}</p> : null}
      </header>
      <p className="mt-3 flex-1 font-ui text-sm leading-relaxed text-ink-dim">{description}</p>
      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold">{status}</span>
        {tech.map((t) => (
          <span
            key={t}
            className="border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-dim"
          >
            {t}
          </span>
        ))}
      </footer>
    </article>
  );
}

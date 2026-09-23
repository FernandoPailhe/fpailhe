import type { Project } from "@ferpa/data-model";
import { formatProjectLinkLabel } from "@ferpa/data-model";
import { TextLink } from "@ferpa/ui";

export interface ProjectArchiveListProps {
  heading: string;
  projects: Project[];
  note?: string;
}

/**
 * Lista compacta "More projects": una fila por proyecto no destacado
 * (nombre + contexto | resumen de una línea, estado, stack y links).
 * Desplegable nativo (`<details>`): colapsada por defecto para no
 * competir con la grilla de tarjetas.
 */
export function ProjectArchiveList({ heading, projects, note }: ProjectArchiveListProps) {
  if (projects.length === 0) return null;
  return (
    <details className="group mt-12">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-xl font-medium text-ink transition-colors select-none hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
          aria-hidden="true"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
        <h3>{heading}</h3>
      </summary>
      <ul className="mt-4 border-b border-line">
        {projects.map((project) => (
          <li
            key={project.id}
            className="grid gap-1 border-t border-line py-4 sm:grid-cols-[200px_1fr] sm:gap-6"
          >
            <div>
              <h4 className="font-display text-base font-medium text-ink">{project.name}</h4>
              {project.context ? (
                <p className="mt-0.5 font-mono text-xs text-ink-faint">{project.context}</p>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="font-ui text-sm leading-relaxed text-ink-dim">
                {project.tagline ?? project.description}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint">
                {project.status !== "live" ? (
                  <span className="uppercase tracking-[0.1em] text-gold">{project.status}</span>
                ) : null}
                <span>{project.tech.join(" · ")}</span>
                {project.links?.map((link) => (
                  <TextLink key={link.url} href={link.url} external className="text-xs">
                    {link.label ?? formatProjectLinkLabel(link.type)}
                  </TextLink>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-4 font-ui text-sm text-ink-dim">{note}</p> : null}
    </details>
  );
}

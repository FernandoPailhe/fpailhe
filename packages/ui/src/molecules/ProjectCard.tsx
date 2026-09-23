import { TextLink } from "../atoms/TextLink";

export interface ProjectCardLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface ProjectCardProps {
  name: string;
  context?: string;
  tech: string[];
  description: string;
  status: "live" | "in-progress" | "unreleased" | "discontinued";
  /** @deprecated pass `links` instead */
  link?: string;
  links?: ProjectCardLink[];
  imageUrl?: string;
  /** Ruta interna a la página de detalle (ej. `/projects/tune-up`). Si existe, el nombre linkea ahí. */
  detailHref?: string;
}

/**
 * Tarjeta de proyecto. Pensada para grillas de hairline: el contenedor
 * externo usa `bg-line` + `gap-px` y cada card pinta su propio fondo.
 * Soporta una captura opcional y una lista de links públicos; si solo
 * llega el `link` legacy, se muestra como un único item "Website".
 */
export function ProjectCard({
  name,
  context,
  tech,
  description,
  status,
  link,
  links,
  imageUrl,
  detailHref,
}: ProjectCardProps) {
  const effectiveLinks: ProjectCardLink[] =
    links ?? (link ? [{ label: "Website", href: link, external: true }] : []);
  const primaryHref = effectiveLinks[0]?.href;

  return (
    <article className="flex h-full flex-col bg-surface-raised p-5">
      {imageUrl ? (
        <img src={imageUrl} alt={`${name} screenshot`} className="mb-4 border border-line" />
      ) : null}
      <header>
        <h3 className="font-display text-lg font-medium text-ink">
          {detailHref ? (
            <TextLink href={detailHref}>{name}</TextLink>
          ) : primaryHref ? (
            <TextLink href={primaryHref} external>
              {name}
            </TextLink>
          ) : (
            name
          )}
        </h3>
        {context ? <p className="mt-1 font-mono text-xs text-ink-faint">{context}</p> : null}
      </header>
      <p className="mt-3 flex-1 font-ui text-sm leading-relaxed text-ink-dim">{description}</p>
      {effectiveLinks.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {effectiveLinks.map((l) => (
            <li key={l.href}>
              <TextLink href={l.href} external={l.external}>
                {l.label}
              </TextLink>
            </li>
          ))}
        </ul>
      ) : null}
      {detailHref ? (
        <p className="mt-3">
          <TextLink href={detailHref}>Details →</TextLink>
        </p>
      ) : null}
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

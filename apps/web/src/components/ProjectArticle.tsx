import type { Project, ProjectDetail, ProjectDetailSection } from "@ferpa/data-model";
import { formatProjectLinkLabel } from "@ferpa/data-model";
import { MediaFigure, TextLink } from "@ferpa/ui";

export interface ProjectArticleProps {
  project: Project;
  detail: ProjectDetail;
}

function DetailSection({
  section,
  children,
}: {
  section: ProjectDetailSection;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[clamp(1.4rem,2.5vw,1.8rem)] font-medium text-ink">
        {section.heading}
      </h2>
      {children}
      {section.paragraphs.map((p, i) => (
        <p key={i} className="mt-4 max-w-[62ch] font-ui text-base leading-relaxed text-ink-dim">
          {p}
        </p>
      ))}
      {section.bullets && section.bullets.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1.5 pl-5">
          {section.bullets.map((b, i) => (
            <li key={i} className="font-ui text-sm leading-relaxed text-ink-dim">
              {b}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Cuerpo completo de la página de detalle de proyecto: header con
 * contexto/status/stack, secciones product/tech/role, links y galería.
 */
export function ProjectArticle({ project, detail }: ProjectArticleProps) {
  const links = detail.links ?? [];
  const media = detail.media ?? [];

  return (
    <article className="py-16">
      <TextLink href="/#projects">← Back to projects</TextLink>

      <header className="mt-8">
        {project.context ? (
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-faint">
            {project.context}
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] font-medium text-ink">
          {project.name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold">
            {project.status}
          </span>
          {detail.technical.stack.map((t) => (
            <span
              key={t}
              className="border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-dim"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      <DetailSection section={detail.product} />
      <DetailSection section={detail.technical} />
      <DetailSection section={detail.role}>
        <p className="mt-4 font-mono text-sm text-ink-faint">{detail.role.title}</p>
      </DetailSection>

      {links.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-lg font-medium text-ink">Links</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {links.map((l) => (
              <li key={l.url}>
                <TextLink href={l.url} external>
                  {l.label ?? formatProjectLinkLabel(l.type)}
                </TextLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {media.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-lg font-medium text-ink">Media</h2>
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {media.map((m, i) => (
              <MediaFigure
                key={i}
                type={m.type}
                src={m.src}
                alt={m.alt}
                title={m.title}
                caption={m.caption}
                poster={m.poster}
              />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

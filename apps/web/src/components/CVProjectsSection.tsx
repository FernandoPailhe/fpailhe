import { formatProjectLinkLabel, type Project } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { AutoLink } from "./AutoLink";
import { IconStar } from "./CVIcons";

export interface CVProjectsSectionProps {
  projects: Project[];
}

/** Sección Projects del documento impreso: proyectos personales. */
export function CVProjectsSection({ projects }: CVProjectsSectionProps) {
  if (projects.length === 0) return null;
  return (
    <section>
      <CVSectionHeading icon={<IconStar />} title="Projects" />
      <div className="mt-3 space-y-2.5">
        {projects.map((project) => (
          <article key={project.id} className="break-inside-avoid">
            <h3 className="font-ui text-sm font-semibold text-ink">
              {project.name}
              {project.links && project.links.length > 0 ? (
                <span className="font-normal text-ink-dim">
                  {project.links.map((link) => (
                    <span key={link.url}>
                      {" · "}
                      <AutoLink
                        value={link.url}
                        label={link.label ?? formatProjectLinkLabel(link.type)}
                      />
                    </span>
                  ))}
                </span>
              ) : null}
            </h3>
            <p className="mt-0.5 font-ui text-sm leading-relaxed text-ink-dim">
              {project.description}
            </p>
            {project.tech.length > 0 ? (
              <p className="mt-1 font-ui text-xs leading-relaxed text-ink-dim">
                <span className="font-semibold text-ink">Key Technologies: </span>
                {project.tech.join(", ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

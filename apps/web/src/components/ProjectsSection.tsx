import type { Project, ProjectLink } from "@ferpa/data-model";
import { formatProjectLinkLabel } from "@ferpa/data-model";
import { ProjectCard } from "@ferpa/ui";
import type { ProjectCardLink } from "@ferpa/ui";
import { ProjectArchiveList } from "./ProjectArchiveList";

export interface ProjectsSectionProps {
  projects: Project[];
  detailIds?: ReadonlySet<string>;
  heading?: string;
  /** Proyectos no destacados, listados en formato compacto debajo de la grilla. */
  archive?: Project[];
  archiveHeading?: string;
  archiveNote?: string;
}

function toCardLink(link: ProjectLink): ProjectCardLink {
  return {
    label: link.label ?? formatProjectLinkLabel(link.type),
    href: link.url,
    external: true,
  };
}

function toImageUrl(screenshot: string | undefined): string | undefined {
  if (!screenshot) return undefined;
  return screenshot.startsWith("/") ? screenshot : `/${screenshot}`;
}

/**
 * Grilla de proyectos destacados con hairlines (fondo `line` + `gap-px`)
 * y, opcionalmente, la lista compacta "More projects" debajo.
 */
export function ProjectsSection({
  projects,
  detailIds,
  heading = "Projects",
  archive = [],
  archiveHeading = "More projects",
  archiveNote,
}: ProjectsSectionProps) {
  return (
    <section id="projects" className="py-16">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">
        {heading}
      </h2>
      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-px border border-line bg-line">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            name={project.name}
            context={project.context}
            tech={project.tech}
            description={project.description}
            status={project.status}
            link={project.link}
            links={project.links?.map(toCardLink)}
            imageUrl={toImageUrl(project.screenshot)}
            detailHref={detailIds?.has(project.id) ? `/projects/${project.id}` : undefined}
          />
        ))}
      </div>
      <ProjectArchiveList heading={archiveHeading} projects={archive} note={archiveNote} />
    </section>
  );
}

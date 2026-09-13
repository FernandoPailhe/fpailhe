import type { Project, ProjectLink } from "@ferpa/data-model";
import { ProjectCard } from "@ferpa/ui";
import type { ProjectCardLink } from "@ferpa/ui";

export interface ProjectsSectionProps {
  projects: Project[];
}

const LINK_LABELS: Record<ProjectLink["type"], string> = {
  appStore: "App Store",
  playStore: "Play Store",
  github: "GitHub",
  website: "Website",
};

function defaultLabel(type: ProjectLink["type"]): string {
  return LINK_LABELS[type];
}

function toCardLink(link: ProjectLink): ProjectCardLink {
  return { label: link.label ?? defaultLabel(link.type), href: link.url, external: true };
}

function toImageUrl(screenshot: string | undefined): string | undefined {
  if (!screenshot) return undefined;
  return screenshot.startsWith("/") ? screenshot : `/${screenshot}`;
}

/** Grilla de proyectos con hairlines: fondo `line` + `gap-px`. */
export function ProjectsSection({ projects }: ProjectsSectionProps) {
  return (
    <section id="projects" className="py-16">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">
        Projects
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
          />
        ))}
      </div>
    </section>
  );
}

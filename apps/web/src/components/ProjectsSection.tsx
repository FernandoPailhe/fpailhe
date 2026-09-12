import type { Project } from "@ferpa/data-model";
import { ProjectCard } from "@ferpa/ui";

export interface ProjectsSectionProps {
  projects: Project[];
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
          />
        ))}
      </div>
    </section>
  );
}

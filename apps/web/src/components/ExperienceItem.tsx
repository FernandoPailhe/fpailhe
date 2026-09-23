import type { Job, Project } from "@ferpa/data-model";
import { TimelineItem } from "@ferpa/ui";
import { useFormattedDateRange, useJobProjects } from "../domain/useSiteDomain";
import { AutoLink } from "./AutoLink";

export interface ExperienceItemProps {
  job: Job;
  projects: Project[];
}

/** Una entrada del timeline: formatea fechas y resuelve proyectos del job. */
export function ExperienceItem({ job, projects }: ExperienceItemProps) {
  const dateRange = useFormattedDateRange(job.startDate, job.endDate);
  const jobProjects = useJobProjects(job, projects);

  return (
    <TimelineItem
      dateRange={dateRange}
      title={job.title}
      company={job.company}
      location={job.location}
      bullets={job.bullets}
      tech={job.tech}
    >
      {jobProjects.length > 0 ? (
        <p className="mt-3 font-mono text-xs text-ink-faint">
          Projects:{" "}
          {jobProjects.map((p, i) => (
            <span key={p.id}>
              {i > 0 ? " · " : ""}
              <AutoLink
                value={p.links?.[0]?.url ?? p.name}
                label={p.name}
                className="hover:text-ink"
              />
            </span>
          ))}
        </p>
      ) : null}
    </TimelineItem>
  );
}

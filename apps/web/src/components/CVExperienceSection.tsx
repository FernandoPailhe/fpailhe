import type { Job, Project } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { IconBriefcase } from "./CVIcons";
import { CVJobItem } from "./CVJobItem";

export interface CVExperienceSectionProps {
  /** Jobs ya ordenados (la página usa `useSortedExperience`). */
  jobs: Job[];
  projects: Project[];
}

/** Employment History del documento impreso. */
export function CVExperienceSection({ jobs, projects }: CVExperienceSectionProps) {
  return (
    <section>
      <CVSectionHeading icon={<IconBriefcase />} title="Employment History" />
      <div className="mt-6 space-y-8">
        {jobs.map((job) => (
          <CVJobItem key={job.id} job={job} projects={projects} />
        ))}
      </div>
    </section>
  );
}

import type { Job } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { IconBriefcase } from "./CVIcons";
import { CVJobItem } from "./CVJobItem";

export interface CVExperienceSectionProps {
  /** Jobs ya ordenados (la página usa `useSortedExperience`). */
  jobs: Job[];
}

/** Employment History del documento impreso. */
export function CVExperienceSection({ jobs }: CVExperienceSectionProps) {
  return (
    <section>
      <CVSectionHeading icon={<IconBriefcase />} title="Employment History" />
      <div className="mt-3 space-y-3">
        {jobs.map((job) => (
          <CVJobItem key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
}

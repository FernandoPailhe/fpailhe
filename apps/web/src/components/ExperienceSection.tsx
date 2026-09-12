import type { Job, Project } from "@ferpa/data-model";
import { useSortedExperience } from "../domain/useSiteDomain";
import { ExperienceItem } from "./ExperienceItem";

export interface ExperienceSectionProps {
  jobs: Job[];
  projects: Project[];
}

export function ExperienceSection({ jobs, projects }: ExperienceSectionProps) {
  const sortedJobs = useSortedExperience(jobs);

  return (
    <section className="py-16">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">
        Experience
      </h2>
      <div className="mt-6">
        {sortedJobs.map((job) => (
          <ExperienceItem key={job.id} job={job} projects={projects} />
        ))}
      </div>
    </section>
  );
}

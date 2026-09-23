import type { Job } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { useFormattedDateRange } from "../domain/useSiteDomain";
import { IconBriefcase } from "./CVIcons";

export interface CVOtherExperienceSectionProps {
  jobs: Job[];
}

function OtherJobLine({ job }: { job: Job }) {
  const dateRange = useFormattedDateRange(job.startDate, job.endDate);
  return (
    <li className="font-ui text-sm leading-relaxed text-ink-dim">
      <span className="font-semibold text-ink">{job.title}</span>, {job.company}
      <span className="font-mono text-[11px] text-ink-faint"> · {dateRange}</span>
      {job.cvNote ? <span> · {job.cvNote}</span> : null}
    </li>
  );
}

/** Roles fuera del foco del CV (audiovisual) en una línea cada uno. */
export function CVOtherExperienceSection({ jobs }: CVOtherExperienceSectionProps) {
  if (jobs.length === 0) return null;
  return (
    <section className="break-inside-avoid">
      <CVSectionHeading icon={<IconBriefcase />} title="Other Experience" />
      <ul className="mt-3 space-y-0.5">
        {jobs.map((job) => (
          <OtherJobLine key={job.id} job={job} />
        ))}
      </ul>
    </section>
  );
}

import type { Job, Project } from "@ferpa/data-model";
import { useFormattedDateRange, useJobProjects } from "../domain/useSiteDomain";
import { AutoLink } from "./AutoLink";

export interface CVJobItemProps {
  job: Job;
  projects: Project[];
}

/**
 * Una entrada del CV impreso: título+empresa, fecha en mono, summary, bullets,
 * Key Technologies (texto corrido), Projects (mini-lista) y Skills developed.
 * Solo se usa en el documento de print — la pantalla usa `ExperienceItem`.
 */
export function CVJobItem({ job, projects }: CVJobItemProps) {
  const dateRange = useFormattedDateRange(job.startDate, job.endDate);
  const jobProjects = useJobProjects(job, projects);

  return (
    <article className="border-t border-line pt-6 first:border-t-0 first:pt-0">
      <h3 className="font-ui text-sm font-semibold text-ink">
        {job.title} at {job.company}
        {job.location ? `, ${job.location}` : ""}
      </h3>
      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{dateRange}</p>
      {job.summary ? (
        <p className="mt-2 font-ui text-sm leading-relaxed text-ink-dim">{job.summary}</p>
      ) : null}
      {job.bullets.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-ink-faint">
          {job.bullets.map((bullet) => (
            <li key={bullet} className="font-ui text-sm leading-relaxed text-ink-dim">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
      {job.tech.length > 0 ? (
        <p className="mt-3 font-ui text-xs leading-relaxed text-ink-dim">
          <span className="font-semibold text-ink">Key Technologies: </span>
          {job.tech.join(", ")}
        </p>
      ) : null}
      {jobProjects.length > 0 ? (
        <div className="mt-2">
          <span className="font-ui text-xs font-semibold text-ink">Projects:</span>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 font-ui text-xs text-ink-dim marker:text-ink-faint">
            {jobProjects.map((p) => (
              <li key={p.id}>
                <AutoLink value={p.links?.[0]?.url ?? p.name} label={p.name} />
                {p.context ? ` (${p.context})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {job.skillsDeveloped && job.skillsDeveloped.length > 0 ? (
        <p className="mt-2 font-ui text-xs text-ink-dim">
          <span className="font-semibold text-ink">Skills developed: </span>
          {job.skillsDeveloped.join(" · ")}
        </p>
      ) : null}
    </article>
  );
}

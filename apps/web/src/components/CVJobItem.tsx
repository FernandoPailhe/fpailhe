import type { Job } from "@ferpa/data-model";
import { useFormattedDateRange } from "../domain/useSiteDomain";

export interface CVJobItemProps {
  job: Job;
}

/**
 * Una entrada del CV impreso: título+empresa, fecha en mono, bullets,
 * Key Technologies (texto corrido) y Skills developed. El `summary` y la
 * mini-lista de proyectos quedan solo en pantalla: el PDF va a 2 páginas.
 * Solo se usa en el documento de print — la pantalla usa `ExperienceItem`.
 */
export function CVJobItem({ job }: CVJobItemProps) {
  const dateRange = useFormattedDateRange(job.startDate, job.endDate);

  return (
    <article className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      {/* Título + fecha nunca quedan solos al pie de la hoja. */}
      <div className="break-inside-avoid break-after-avoid">
        <h3 className="font-ui text-sm font-semibold text-ink">
          {job.title} at {job.company}
          {job.location ? `, ${job.location}` : ""}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{dateRange}</p>
      </div>
      {job.bullets.length > 0 ? (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 marker:text-ink-faint">
          {job.bullets.map((bullet) => (
            <li key={bullet} className="font-ui text-sm leading-relaxed text-ink-dim">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
      {job.tech.length > 0 ? (
        <p className="mt-1.5 font-ui text-xs leading-relaxed text-ink-dim">
          <span className="font-semibold text-ink">Key Technologies: </span>
          {job.tech.join(", ")}
        </p>
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

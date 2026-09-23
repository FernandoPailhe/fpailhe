import type { EducationEntry } from "@ferpa/data-model";
import { useFormattedDateRange } from "../domain/useSiteDomain";

export interface CVEducationItemProps {
  entry: EducationEntry;
}

/** Una línea: título, institución y fechas (el PDF va a 2 páginas). */
export function CVEducationItem({ entry }: CVEducationItemProps) {
  const dateRange = useFormattedDateRange(entry.startDate, entry.endDate);

  return (
    <p className="break-inside-avoid font-ui text-sm leading-relaxed text-ink-dim">
      <span className="font-semibold text-ink">{entry.degree}</span>, {entry.institution}
      <span className="font-mono text-[11px] text-ink-faint"> · {dateRange}</span>
    </p>
  );
}

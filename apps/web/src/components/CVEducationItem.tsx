import type { EducationEntry } from "@ferpa/data-model";
import { useFormattedDateRange } from "../domain/useSiteDomain";

export interface CVEducationItemProps {
  entry: EducationEntry;
}

export function CVEducationItem({ entry }: CVEducationItemProps) {
  const dateRange = useFormattedDateRange(entry.startDate, entry.endDate);

  return (
    <article className="break-inside-avoid">
      <h3 className="font-ui text-sm font-semibold text-ink">{entry.degree}</h3>
      <p className="mt-0.5 font-ui text-sm text-ink-dim">{entry.institution}</p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{dateRange}</p>
    </article>
  );
}

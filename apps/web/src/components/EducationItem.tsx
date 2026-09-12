import type { EducationEntry } from "@ferpa/data-model";
import { useFormattedDateRange } from "../domain/useSiteDomain";

export interface EducationItemProps {
  entry: EducationEntry;
}

export function EducationItem({ entry }: EducationItemProps) {
  const dateRange = useFormattedDateRange(entry.startDate, entry.endDate);

  return (
    <div className="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-5 mobile:grid-cols-1 mobile:gap-1">
      <span className="pt-1 font-mono text-xs text-ink-faint">{dateRange}</span>
      <div className="min-w-0">
        <h3 className="font-ui text-sm font-semibold text-ink">{entry.degree}</h3>
        <p className="mt-0.5 font-ui text-sm text-ink-dim">{entry.institution}</p>
      </div>
    </div>
  );
}

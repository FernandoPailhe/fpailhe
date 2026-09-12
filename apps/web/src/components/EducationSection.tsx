import type { EducationEntry } from "@ferpa/data-model";
import { EducationItem } from "./EducationItem";

export interface EducationSectionProps {
  education: EducationEntry[];
}

export function EducationSection({ education }: EducationSectionProps) {
  return (
    <section className="py-16">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">
        Education
      </h2>
      <div className="mt-6">
        {education.map((entry) => (
          <EducationItem key={entry.degree} entry={entry} />
        ))}
      </div>
    </section>
  );
}

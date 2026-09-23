import type { EducationEntry } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { IconGraduationCap } from "./CVIcons";
import { CVEducationItem } from "./CVEducationItem";

export interface CVEducationSectionProps {
  education: EducationEntry[];
}

export function CVEducationSection({ education }: CVEducationSectionProps) {
  return (
    <section className="break-inside-avoid">
      <CVSectionHeading icon={<IconGraduationCap />} title="Education" />
      <div className="mt-6 space-y-5">
        {education.map((entry) => (
          <CVEducationItem key={entry.degree} entry={entry} />
        ))}
      </div>
    </section>
  );
}

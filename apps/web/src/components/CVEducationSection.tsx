import type { CourseEntry, EducationEntry } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { IconGraduationCap } from "./CVIcons";
import { CVCourseLine } from "./CVCoursesSection";
import { CVEducationItem } from "./CVEducationItem";

export interface CVEducationSectionProps {
  education: EducationEntry[];
  courses?: CourseEntry[];
}

/** Education y Courses en una sola sección compacta, una línea por entrada. */
export function CVEducationSection({ education, courses = [] }: CVEducationSectionProps) {
  return (
    <section className="break-inside-avoid">
      <CVSectionHeading
        icon={<IconGraduationCap />}
        title={courses.length > 0 ? "Education & Courses" : "Education"}
      />
      <div className="mt-3 space-y-0.5">
        {education.map((entry) => (
          <CVEducationItem key={entry.degree} entry={entry} />
        ))}
        {courses.length > 0 ? (
          <ul className="space-y-0.5">
            {courses.map((course) => (
              <CVCourseLine key={course.name} course={course} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

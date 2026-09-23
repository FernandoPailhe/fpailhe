import type { CourseEntry } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { IconBook } from "./CVIcons";

export interface CVCoursesSectionProps {
  courses: CourseEntry[];
}

export function CVCoursesSection({ courses }: CVCoursesSectionProps) {
  return (
    <section className="break-inside-avoid">
      <CVSectionHeading icon={<IconBook />} title="Courses" />
      <ul className="mt-6 space-y-5">
        {courses.map((course) => (
          <li key={course.name} className="break-inside-avoid">
            <h3 className="font-ui text-sm font-semibold text-ink">{course.name}</h3>
            <p className="mt-0.5 font-ui text-sm text-ink-dim">{course.institution}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{course.date}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

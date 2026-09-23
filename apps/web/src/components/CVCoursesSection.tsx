import type { CourseEntry } from "@ferpa/data-model";

export interface CVCourseLineProps {
  course: CourseEntry;
}

/**
 * Un curso en una línea (nombre, institución, año). Se renderiza dentro de
 * la sección "Education & Courses" de `CVEducationSection`.
 */
export function CVCourseLine({ course }: CVCourseLineProps) {
  return (
    <li className="font-ui text-sm leading-relaxed text-ink-dim">
      <span className="font-semibold text-ink">{course.name}</span>, {course.institution}
      <span className="font-mono text-[11px] text-ink-faint"> · {course.date}</span>
    </li>
  );
}

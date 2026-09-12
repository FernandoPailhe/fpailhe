import type { CourseEntry } from "@ferpa/data-model";

export interface CoursesSectionProps {
  courses: CourseEntry[];
}

export function CoursesSection({ courses }: CoursesSectionProps) {
  return (
    <section className="py-16">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium text-ink">
        Courses
      </h2>
      <ul className="mt-6">
        {courses.map((course) => (
          <li
            key={course.name}
            className="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-4 mobile:grid-cols-1 mobile:gap-1"
          >
            <span className="pt-0.5 font-mono text-xs text-ink-faint">{course.date}</span>
            <div className="min-w-0">
              <h3 className="font-ui text-sm font-semibold text-ink">{course.name}</h3>
              <p className="mt-0.5 font-ui text-sm text-ink-dim">{course.institution}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

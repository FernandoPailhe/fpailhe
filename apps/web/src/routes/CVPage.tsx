import { FilledButton } from "@ferpa/ui";
import {
  useCoursesQuery,
  useEducationQuery,
  useExperienceQuery,
  useProfileQuery,
  useProjectsQuery,
} from "../queries/useSiteData";
import { useSortedExperience } from "../domain/useSiteDomain";
import {
  CoursesSection,
  EducationSection,
  ErrorState,
  ExperienceSection,
  LoadingState,
  Nav,
} from "../components";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "CV", href: "/cv" },
];

export function CVPage() {
  const profile = useProfileQuery();
  const experience = useExperienceQuery();
  const education = useEducationQuery();
  const courses = useCoursesQuery();
  const projects = useProjectsQuery();

  const sortedJobs = useSortedExperience(experience.data);

  const queries = [profile, experience, education, courses, projects];
  if (queries.some((q) => q.isLoading)) return <LoadingState />;
  if (
    queries.some((q) => q.isError) ||
    !profile.data ||
    !experience.data ||
    !education.data ||
    !courses.data ||
    !projects.data
  ) {
    return <ErrorState label="No se pudo cargar el CV." />;
  }

  return (
    <>
      <Nav links={NAV_LINKS} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[760px] px-[clamp(20px,5vw,32px)] pb-16"
      >
        <header className="border-b border-line py-12">
          <h1 className="font-display text-3xl font-medium text-ink">{profile.data.name}</h1>
          <p className="mt-2 font-ui text-base text-ink-dim">
            {profile.data.role} — {profile.data.location} · {profile.data.remoteNote}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-faint">
            <a href={`mailto:${profile.data.email}`} className="hover:text-ink">
              {profile.data.email}
            </a>
            <a
              href={profile.data.linkedin}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              LinkedIn
            </a>
            <a
              href={profile.data.github}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              GitHub
            </a>
            <span>{profile.data.domain}</span>
          </div>
          <FilledButton className="no-print mt-6" onClick={() => window.print()}>
            Download PDF
          </FilledButton>
        </header>
        <ExperienceSection jobs={sortedJobs} projects={projects.data} />
        <EducationSection education={education.data} />
        <CoursesSection courses={courses.data} />
      </main>
    </>
  );
}

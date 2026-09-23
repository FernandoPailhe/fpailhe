import { CVSectionHeading, FilledButton } from "@ferpa/ui";
import {
  useCoursesQuery,
  useEducationQuery,
  useExperienceQuery,
  useLanguagesQuery,
  useProfileQuery,
  useProjectsQuery,
  useSkillsQuery,
} from "../queries/useSiteData";
import { useCVJobs, useCVProjects, useSortedExperience } from "../domain/useSiteDomain";
import {
  CoursesSection,
  CVDetailsBlock,
  CVEducationSection,
  CVExperienceSection,
  CVHeader,
  CVLanguagesBlock,
  CVOtherExperienceSection,
  CVProjectsSection,
  CVSkillsBlock,
  EducationSection,
  ErrorState,
  ExperienceSection,
  IconUser,
  LoadingState,
  Nav,
} from "../components";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "CV", href: "/cv" },
  { label: "Lab", href: "/lab/trymate" },
];

export function CVPage() {
  const profile = useProfileQuery();
  const experience = useExperienceQuery();
  const education = useEducationQuery();
  const courses = useCoursesQuery();
  const projects = useProjectsQuery();
  const skills = useSkillsQuery();
  const languages = useLanguagesQuery();

  const sortedJobs = useSortedExperience(experience.data);
  const cvJobs = useCVJobs(sortedJobs);
  const cvProjects = useCVProjects(projects.data);

  const queries = [profile, experience, education, courses, projects, skills, languages];
  if (queries.some((q) => q.isLoading)) return <LoadingState />;
  if (
    queries.some((q) => q.isError) ||
    !profile.data ||
    !experience.data ||
    !education.data ||
    !courses.data ||
    !projects.data ||
    !skills.data ||
    !languages.data
  ) {
    return <ErrorState label="Could not load CV." />;
  }

  return (
    <>
      <Nav links={NAV_LINKS} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[760px] px-[clamp(20px,5vw,32px)] pb-16 print:pb-0"
      >
        {/* Pantalla: diseño original de una columna */}
        <div className="print:hidden">
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
            <FilledButton className="mt-6" onClick={() => window.print()}>
              Download PDF
            </FilledButton>
          </header>
          <ExperienceSection jobs={sortedJobs} projects={projects.data} />
          <EducationSection education={education.data} />
          <CoursesSection courses={courses.data} />
        </div>

        {/* Documento de impresión: layout de 2 columnas del PDF de referencia */}
        <div className="hidden print:block">
          <CVHeader profile={profile.data} />
          <div className="cv-layout">
            <aside className="bg-paper space-y-8 px-6 py-8 print:space-y-4 print:py-5">
              <CVDetailsBlock profile={profile.data} />
              <CVSkillsBlock skills={skills.data} />
              <CVLanguagesBlock languages={languages.data} />
            </aside>
            <div className="space-y-10 px-8 py-8 print:space-y-3 print:py-4">
              <section aria-label="Profile">
                <CVSectionHeading icon={<IconUser />} title="Profile" />
                <p className="mt-3 font-ui text-sm leading-relaxed text-ink-dim">
                  {profile.data.summary}
                </p>
              </section>
              <CVExperienceSection jobs={cvJobs.main} />
              <CVProjectsSection projects={cvProjects} />
              <CVOtherExperienceSection jobs={cvJobs.other} />
              <CVEducationSection education={education.data} courses={courses.data} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

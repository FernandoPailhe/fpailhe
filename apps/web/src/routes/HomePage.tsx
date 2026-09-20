import {
  useAboutAsideQuery,
  useContactQuery,
  useHeroQuery,
  useHowIWorkQuery,
  useProfileQuery,
  useProjectDetailsQuery,
  useProjectsQuery,
  useStatsQuery,
} from "../queries/useSiteData";
import { useFeaturedProjects, useProjectDetailIds } from "../domain/useSiteDomain";
import {
  AboutSection,
  ContactSection,
  ErrorState,
  HeroSection,
  HowIWorkSection,
  LoadingState,
  Nav,
  ProjectsSection,
  StatsSection,
} from "../components";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Work", href: "#work" },
  { label: "Projects", href: "#projects" },
  { label: "CV", href: "/cv" },
  { label: "Lab", href: "/lab/trymate" },
  { label: "Contact", href: "#contact" },
];

export function HomePage() {
  const profile = useProfileQuery();
  const hero = useHeroQuery();
  const stats = useStatsQuery();
  const howIWork = useHowIWorkQuery();
  const aboutAside = useAboutAsideQuery();
  const projects = useProjectsQuery();
  const projectDetails = useProjectDetailsQuery();
  const contact = useContactQuery();

  const featuredProjects = useFeaturedProjects(projects.data);
  const detailIds = useProjectDetailIds(projectDetails.data);

  const queries = [profile, hero, stats, howIWork, aboutAside, projects, projectDetails, contact];
  if (queries.some((q) => q.isLoading)) return <LoadingState />;
  if (
    queries.some((q) => q.isError) ||
    !profile.data ||
    !hero.data ||
    !stats.data ||
    !howIWork.data ||
    !aboutAside.data ||
    !projects.data ||
    !projectDetails.data ||
    !contact.data
  ) {
    return <ErrorState label="Could not load site data." />;
  }

  return (
    <>
      <Nav links={NAV_LINKS} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]"
      >
        <HeroSection
          kicker={hero.data.kicker}
          headlineLead={hero.data.headlineLead}
          headlineEmphasis={hero.data.headlineEmphasis}
          subhead={hero.data.subhead}
          ctas={hero.data.ctas}
        />
      </main>
      <StatsSection stats={stats.data} />
      <main className="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]">
        <HowIWorkSection panels={howIWork.data.panels} closingNote={howIWork.data.closingNote} />
        <AboutSection text={aboutAside.data.text} photo={aboutAside.data.photo} />
        <ProjectsSection projects={featuredProjects} detailIds={detailIds} />
      </main>
      <ContactSection
        heading={contact.data.heading}
        body={contact.data.body}
        email={profile.data.email}
      />
    </>
  );
}

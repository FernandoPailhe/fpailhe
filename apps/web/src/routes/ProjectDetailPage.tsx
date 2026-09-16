import { useParams } from "react-router-dom";
import { useProjectDetailsQuery, useProjectsQuery } from "../queries/useSiteData";
import { useProjectById, useProjectDetail } from "../domain/useSiteDomain";
import { ErrorState, LoadingState, Nav, ProjectArticle } from "../components";
import { NotFoundPage } from "./NotFoundPage";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "CV", href: "/cv" },
];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projects = useProjectsQuery();
  const details = useProjectDetailsQuery();

  const project = useProjectById(projects.data, projectId);
  const detail = useProjectDetail(details.data, projectId);

  if (projects.isLoading || details.isLoading) return <LoadingState />;
  if (projects.isError || details.isError) {
    return <ErrorState label="Could not load project data." />;
  }
  if (!project || !detail) return <NotFoundPage />;

  return (
    <>
      <Nav links={NAV_LINKS} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]"
      >
        <ProjectArticle project={project} detail={detail} />
      </main>
    </>
  );
}

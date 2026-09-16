import type { Job, Project, ProjectDetail } from "./types";

/**
 * Lógica de dominio pura del sitio.
 *
 * Las funciones en este archivo deben ser puras (sin side-effects,
 * sin imports de React) para poder reutilizarse en cualquier contexto
 * (app, backend, tests, scripts, futuro renderizado PDF).
 */

/** Filtra los proyectos marcados como `featured` (se muestran en Home). */
export function getFeaturedProjects(projects: Project[]): Project[] {
  return projects.filter((p) => p.featured);
}

/** Resuelve `job.projectIds` contra la lista canónica de proyectos. */
export function getJobProjects(job: Job, projects: Project[]): Project[] {
  const ids = new Set(job.projectIds ?? []);
  return projects.filter((p) => ids.has(p.id));
}

/** Busca un proyecto por `id`. Devuelve `undefined` si no existe. */
export function getProjectById(projects: Project[], projectId: string): Project | undefined {
  return projects.find((p) => p.id === projectId);
}

/** Busca el detalle de un proyecto por `projectId`. */
export function getProjectDetail(
  details: ProjectDetail[],
  projectId: string,
): ProjectDetail | undefined {
  return details.find((d) => d.projectId === projectId);
}

/** Ids de proyectos que tienen página de detalle. */
export function getProjectDetailIds(details: ProjectDetail[]): Set<string> {
  return new Set(details.map((d) => d.projectId));
}

/** Ordena jobs cronológicamente en reversa (`endDate` null = presente). */
export function sortJobsByDateDesc(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aEnd = a.endDate ?? "9999-12";
    const bEnd = b.endDate ?? "9999-12";
    if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
    return b.startDate.localeCompare(a.startDate);
  });
}

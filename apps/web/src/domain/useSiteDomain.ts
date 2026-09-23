import { useMemo } from "react";
import type { Job, Project, ProjectDetail } from "@ferpa/data-model";
import {
  formatDateRange,
  formatMonthYear,
  getFeaturedProjects,
  getJobProjects,
  getArchiveProjects,
  getCVProjects,
  partitionJobsForCV,
  getProjectById,
  getProjectDetail,
  getProjectDetailIds,
  sortJobsByDateDesc,
} from "@ferpa/data-model";

/**
 * Hooks de lógica derivada: envuelven las funciones puras de
 * `@ferpa/data-model` en `useMemo` para que organismos y rutas reciban
 * valores ya calculados, sin lógica en JSX. Reciben arrays posiblemente
 * `undefined` (estado de carga) y devuelven arrays vacíos como fallback.
 */

export function useFeaturedProjects(projects: Project[] | undefined) {
  return useMemo(() => {
    if (!projects) return [];
    return getFeaturedProjects(projects);
  }, [projects]);
}

export function useJobProjects(job: Job, projects: Project[] | undefined) {
  return useMemo(() => {
    if (!projects) return [];
    return getJobProjects(job, projects);
  }, [job, projects]);
}

/** Proyecto por id; `undefined` mientras carga o si no existe. */
export function useProjectById(projects: Project[] | undefined, projectId: string | undefined) {
  return useMemo(() => {
    if (!projects || !projectId) return undefined;
    return getProjectById(projects, projectId);
  }, [projects, projectId]);
}

/** Detalle por projectId; `undefined` mientras carga o si no existe. */
export function useProjectDetail(
  details: ProjectDetail[] | undefined,
  projectId: string | undefined,
) {
  return useMemo(() => {
    if (!details || !projectId) return undefined;
    return getProjectDetail(details, projectId);
  }, [details, projectId]);
}

/** Set de projectIds con página de detalle; vacío mientras carga. */
export function useProjectDetailIds(details: ProjectDetail[] | undefined) {
  return useMemo(() => {
    if (!details) return new Set<string>();
    return getProjectDetailIds(details);
  }, [details]);
}

export function useSortedExperience(jobs: Job[] | undefined) {
  return useMemo(() => {
    if (!jobs) return [];
    return sortJobsByDateDesc(jobs);
  }, [jobs]);
}

export function useFormattedDateRange(start: string, end: string | null) {
  return useMemo(() => formatDateRange(start, end), [start, end]);
}

export function useFormattedMonthYear(date: string) {
  return useMemo(() => formatMonthYear(date), [date]);
}

/** Proyectos de la sección Projects del CV impreso (`showInCV`). */
export function useCVProjects(projects: Project[] | undefined) {
  return useMemo(() => {
    if (!projects) return [];
    return getCVProjects(projects);
  }, [projects]);
}

/** Proyectos no destacados para la lista "More projects" del Home. */
export function useArchiveProjects(projects: Project[] | undefined) {
  return useMemo(() => {
    if (!projects) return [];
    return getArchiveProjects(projects);
  }, [projects]);
}

/** Jobs del CV impreso separados en Employment History / Other Experience. */
export function useCVJobs(jobs: Job[]) {
  return useMemo(() => partitionJobsForCV(jobs), [jobs]);
}

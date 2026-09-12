import { useMemo } from "react";
import type { Job, Project } from "@ferpa/data-model";
import {
  formatDateRange,
  formatMonthYear,
  getFeaturedProjects,
  getJobProjects,
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

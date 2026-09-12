/**
 * Claves centralizadas de TanStack Query.
 * Evita duplicar strings y facilita invalidaciones.
 */
export const queryKeys = {
  profile: ["profile"] as const,
  hero: ["hero"] as const,
  stats: ["stats"] as const,
  howIWork: ["howIWork"] as const,
  aboutAside: ["aboutAside"] as const,
  projects: ["projects"] as const,
  experience: ["experience"] as const,
  education: ["education"] as const,
  courses: ["courses"] as const,
  contact: ["contact"] as const,
};

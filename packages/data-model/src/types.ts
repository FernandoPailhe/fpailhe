/**
 * Modelo de datos del sitio Ferpa (fpailhe.com).
 *
 * Estas interfaces son el contrato entre los JSON que hoy viven en
 * `apps/web/public/data/*.json` y el resto de la app. El día que haya un
 * servidor real, el contrato no cambia: solo cambia de dónde lo trae
 * `services/httpClient` (ver `apps/web/src/services`).
 */

export interface Profile {
  name: string;
  role: string;
  location: string;
  remoteNote: string;
  domain: string;
  email: string;
  linkedin: string;
  github: string;
  photo: string;
}

export interface CTA {
  label: string;
  href: string;
  external?: boolean;
}

export interface Hero {
  kicker: string;
  headlineLead: string;
  headlineEmphasis: string;
  subhead: string;
  ctas: CTA[];
}

export interface Stat {
  value: string;
  label: string;
  sublabel: string;
}

export interface WorkPanel {
  heading: string;
  body: string;
}

export interface HowIWork {
  panels: WorkPanel[];
  closingNote: string;
}

export interface AboutAside {
  text: string;
  photo: string;
}

export type ProjectStatus = "live" | "in-progress";

export interface ProjectLink {
  type: "appStore" | "playStore" | "github" | "website";
  url: string;
  label?: string;
}

export interface Project {
  id: string;
  name: string;
  context?: string;
  tech: string[];
  description: string;
  status: ProjectStatus;
  /** @deprecated use `links` instead. Kept for backward compatibility during migration. */
  link?: string;
  links?: ProjectLink[];
  /** Path to a screenshot under `/public/`, e.g. `/project-screenshots/tune-up.png`. */
  screenshot?: string;
  featured: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate: string | null;
  bullets: string[];
  tech: string[];
  projectIds?: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  startDate: string;
  endDate: string;
}

export interface CourseEntry {
  name: string;
  institution: string;
  date: string;
}

export interface ContactSection {
  heading: string;
  body: string;
}

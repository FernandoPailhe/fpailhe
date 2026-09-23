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
  phone: string;
  /** Párrafo "PROFILE" del CV (columna principal). */
  summary: string;
}

export interface Skill {
  name: string;
}

export interface Language {
  name: string;
  /** 0–5, se renderiza como barra/dots de nivel en el CV. */
  level: number;
  /** Texto del nivel, ej. "Native", "Professional working". */
  label: string;
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

/**
 * `unreleased`: se construyó pero nunca salió a producción.
 * `discontinued`: salió, pero hoy ya no está activo (plataforma cerrada, backend apagado).
 */
export type ProjectStatus = "live" | "in-progress" | "unreleased" | "discontinued";

export interface ProjectLink {
  type: "appStore" | "playStore" | "github" | "website" | "youtube";
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
  /** `true` = tarjeta en la grilla del Home; `false` = línea en "More projects". */
  featured: boolean;
  /** Resumen de una línea para la lista "More projects"; si falta se usa `description`. */
  tagline?: string;
  /** Aparece en la sección Projects del CV impreso. */
  showInCV?: boolean;
}

/** Textos de la sección de proyectos del Home (`projects-section.json`). */
export interface ProjectsSectionCopy {
  heading: string;
  archiveHeading: string;
  /** Nota al pie de la lista "More projects". */
  archiveNote?: string;
}

export interface ProjectDetailSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ProjectMediaItem {
  type: "image" | "video" | "embed";
  /** Path bajo `/public` (ej. `/project-media/tune-up/demo.mp4`) o URL externa para `embed`. */
  src: string;
  /** Texto alternativo; obligatorio en la práctica para `image`. */
  alt?: string;
  /** Título accesible del `<iframe>` para `embed`. */
  title?: string;
  caption?: string;
  /** Poster del `<video>` (path bajo `/public`). */
  poster?: string;
}

/**
 * Contenido de la página de detalle de un proyecto (`/projects/<id>`).
 * Vive en `project-details.json`, separado de `projects.json`: solo los
 * proyectos con entrada acá tienen página de detalle y su card navega.
 */
export interface ProjectDetail {
  /** FK a `Project.id`. */
  projectId: string;
  /** Info del producto: qué es, qué resuelve, features. */
  product: ProjectDetailSection;
  /** Info técnica del proyecto: arquitectura, decisiones, stack. */
  technical: ProjectDetailSection & { stack: string[] };
  /** Info técnica del rol; `title` = nombre del rol (ej. "Solo mobile engineer"). */
  role: ProjectDetailSection & { title: string };
  links?: ProjectLink[];
  media?: ProjectMediaItem[];
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
  /** Párrafo introductorio del rol, antes de los bullets. */
  summary?: string;
  /** Lista "Skills developed" para roles no-tech (filmmaker, etc.). */
  skillsDeveloped?: string[];
  /**
   * Sección del CV impreso. `"other"` saca el rol de Employment History y lo
   * muestra como una línea en "Other Experience". Solo afecta al PDF; la
   * página /cv en pantalla sigue mostrando el rol completo.
   */
  cvSection?: "main" | "other";
  /** Aclaración corta que acompaña la línea compacta (ej. "part-time from 2020"). */
  cvNote?: string;
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

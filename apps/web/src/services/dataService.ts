import type {
  AboutAside,
  ContactSection,
  CourseEntry,
  EducationEntry,
  Hero,
  HowIWork,
  Job,
  Profile,
  Project,
  Stat,
} from "@ferpa/data-model";
import { http } from "./httpClient";

/**
 * Capa de servicios. Acá van las llamadas a APIs o archivos
 * estáticos. El día que haya un backend real, solo cambiás estos
 * fetchers — el resto de la app (queries, domain, components) no se
 * entera.
 */

export async function fetchProfile(): Promise<Profile> {
  const { data } = await http.get<Profile>("/profile.json");
  return data;
}

export async function fetchHero(): Promise<Hero> {
  const { data } = await http.get<Hero>("/hero.json");
  return data;
}

export async function fetchStats(): Promise<Stat[]> {
  const { data } = await http.get<Stat[]>("/stats.json");
  return data;
}

export async function fetchHowIWork(): Promise<HowIWork> {
  const { data } = await http.get<HowIWork>("/how-i-work.json");
  return data;
}

export async function fetchAboutAside(): Promise<AboutAside> {
  const { data } = await http.get<AboutAside>("/about-aside.json");
  return data;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data } = await http.get<Project[]>("/projects.json");
  return data;
}

export async function fetchExperience(): Promise<Job[]> {
  const { data } = await http.get<Job[]>("/experience.json");
  return data;
}

export async function fetchEducation(): Promise<EducationEntry[]> {
  const { data } = await http.get<EducationEntry[]>("/education.json");
  return data;
}

export async function fetchCourses(): Promise<CourseEntry[]> {
  const { data } = await http.get<CourseEntry[]>("/courses.json");
  return data;
}

export async function fetchContact(): Promise<ContactSection> {
  const { data } = await http.get<ContactSection>("/contact.json");
  return data;
}

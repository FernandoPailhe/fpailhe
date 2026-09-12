import { useQuery } from "@tanstack/react-query";
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
import {
  fetchAboutAside,
  fetchContact,
  fetchCourses,
  fetchEducation,
  fetchExperience,
  fetchHero,
  fetchHowIWork,
  fetchProfile,
  fetchProjects,
  fetchStats,
} from "../services/dataService";
import { queryKeys } from "./keys";

const staleTime = 5 * 60_000;

export function useProfileQuery() {
  return useQuery<Profile>({ queryKey: queryKeys.profile, queryFn: fetchProfile, staleTime });
}

export function useHeroQuery() {
  return useQuery<Hero>({ queryKey: queryKeys.hero, queryFn: fetchHero, staleTime });
}

export function useStatsQuery() {
  return useQuery<Stat[]>({ queryKey: queryKeys.stats, queryFn: fetchStats, staleTime });
}

export function useHowIWorkQuery() {
  return useQuery<HowIWork>({ queryKey: queryKeys.howIWork, queryFn: fetchHowIWork, staleTime });
}

export function useAboutAsideQuery() {
  return useQuery<AboutAside>({ queryKey: queryKeys.aboutAside, queryFn: fetchAboutAside, staleTime });
}

export function useProjectsQuery() {
  return useQuery<Project[]>({ queryKey: queryKeys.projects, queryFn: fetchProjects, staleTime });
}

export function useExperienceQuery() {
  return useQuery<Job[]>({ queryKey: queryKeys.experience, queryFn: fetchExperience, staleTime });
}

export function useEducationQuery() {
  return useQuery<EducationEntry[]>({ queryKey: queryKeys.education, queryFn: fetchEducation, staleTime });
}

export function useCoursesQuery() {
  return useQuery<CourseEntry[]>({ queryKey: queryKeys.courses, queryFn: fetchCourses, staleTime });
}

export function useContactQuery() {
  return useQuery<ContactSection>({ queryKey: queryKeys.contact, queryFn: fetchContact, staleTime });
}

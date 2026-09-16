import { describe, expect, it } from "vitest";
import {
  getFeaturedProjects,
  getJobProjects,
  getProjectById,
  getProjectDetail,
  getProjectDetailIds,
  sortJobsByDateDesc,
} from "./domain";
import type { Job, Project, ProjectDetail } from "./types";

const baseProject: Project = {
  id: "a",
  name: "A",
  tech: [],
  description: "",
  status: "live",
  featured: true,
};

const baseJob: Job = {
  id: "job",
  title: "Dev",
  company: "X",
  startDate: "2020-01",
  endDate: null,
  bullets: [],
  tech: [],
};

describe("getFeaturedProjects", () => {
  it("returns only featured projects", () => {
    const projects: Project[] = [
      baseProject,
      { ...baseProject, id: "b", name: "B", featured: false },
    ];
    expect(getFeaturedProjects(projects)).toHaveLength(1);
    expect(getFeaturedProjects(projects)[0]?.id).toBe("a");
  });
});

describe("getJobProjects", () => {
  it("resolves projectIds against the project list", () => {
    const projects: Project[] = [baseProject, { ...baseProject, id: "b", name: "B" }];
    const job: Job = { ...baseJob, projectIds: ["b", "missing"] };
    const resolved = getJobProjects(job, projects);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.id).toBe("b");
  });
});

const baseDetail: ProjectDetail = {
  projectId: "a",
  product: { heading: "The product", paragraphs: [] },
  technical: { heading: "The tech", paragraphs: [], stack: [] },
  role: { heading: "My role", title: "Dev", paragraphs: [] },
};

describe("getProjectById", () => {
  it("finds a project by id and returns undefined for a missing id", () => {
    const projects: Project[] = [baseProject, { ...baseProject, id: "b", name: "B" }];
    expect(getProjectById(projects, "b")?.name).toBe("B");
    expect(getProjectById(projects, "missing")).toBeUndefined();
  });
});

describe("getProjectDetail", () => {
  it("finds a detail by projectId and returns undefined if absent", () => {
    const details: ProjectDetail[] = [baseDetail, { ...baseDetail, projectId: "b" }];
    expect(getProjectDetail(details, "b")?.projectId).toBe("b");
    expect(getProjectDetail(details, "missing")).toBeUndefined();
  });
});

describe("getProjectDetailIds", () => {
  it("returns a Set with the projectIds", () => {
    const details: ProjectDetail[] = [baseDetail, { ...baseDetail, projectId: "b" }];
    const ids = getProjectDetailIds(details);
    expect(ids).toBeInstanceOf(Set);
    expect(ids.has("a")).toBe(true);
    expect(ids.has("b")).toBe(true);
    expect(ids.has("c")).toBe(false);
  });
});

describe("sortJobsByDateDesc", () => {
  it("places current job (null endDate) first", () => {
    const jobs: Job[] = [
      { ...baseJob, id: "past", startDate: "2017-07", endDate: "2020-01" },
      { ...baseJob, id: "current", startDate: "2025-08", endDate: null },
    ];
    const sorted = sortJobsByDateDesc(jobs);
    expect(sorted[0]?.id).toBe("current");
  });

  it("sorts closed ranges by endDate descending, then startDate", () => {
    const jobs: Job[] = [
      { ...baseJob, id: "older", startDate: "2011-01", endDate: "2020-01" },
      { ...baseJob, id: "newer", startDate: "2023-04", endDate: "2025-08" },
    ];
    const sorted = sortJobsByDateDesc(jobs);
    expect(sorted.map((j) => j.id)).toEqual(["newer", "older"]);
  });
});

import { describe, expect, it } from "vitest";
import { getFeaturedProjects, getJobProjects, sortJobsByDateDesc } from "./domain";
import type { Job, Project } from "./types";

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

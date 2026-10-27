import { describe, expect, it } from "vitest";
import { getLocalUserId } from "./identity";
import { readJson } from "./storage";

describe("getLocalUserId", () => {
  it("devuelve un id estable entre llamadas y lo persiste", () => {
    const a = getLocalUserId();
    const b = getLocalUserId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(8);
    expect(readJson<string>("universes:local-user-id")).toBe(a);
  });
});

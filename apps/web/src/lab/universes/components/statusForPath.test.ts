import { describe, expect, it } from "vitest";

import { statusForPath } from "./statusForPath";

describe("statusForPath", () => {
  it("tabla completa de rutas", () => {
    expect(statusForPath("/lab/universes")).toBeNull();
    expect(statusForPath("/lab/universes/demo-reino")).toBeNull();
    expect(statusForPath("/lab/universes/demo-reino/jugar")).toBe("live");
    expect(statusForPath("/lab/universes/demo-reino/final")).toBe("ended");
    expect(statusForPath("/lab/universes/demo-reino/jugar/")).toBe("live");
    expect(statusForPath("/lab/universes/demo-reino/final/")).toBe("ended");
    expect(statusForPath("/")).toBeNull();
    expect(statusForPath("/lab/trymate")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { universeKeys } from "./keys";

describe("universeKeys", () => {
  it("son estables y distintas por argumento", () => {
    expect(universeKeys.list()).toEqual(["universes", "list"]);
    expect(universeKeys.list()).toEqual(universeKeys.list());
    expect(universeKeys.content("a")).toEqual(["universes", "content", "a"]);
    expect(universeKeys.content("a")).not.toEqual(universeKeys.content("b"));
    expect(universeKeys.saved("u", "g")).toEqual(["universes", "saved", "u", "g"]);
    expect(universeKeys.saved("u", "g")).not.toEqual(universeKeys.saved("u", "h"));
  });
});

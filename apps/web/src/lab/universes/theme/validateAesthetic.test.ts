import { describe, expect, it } from "vitest";

import type { Game } from "../domain/models";

import { makeGame } from "../domain/engine/testing";
import type { AestheticContext } from "./validateAesthetic";
import { validateAesthetic } from "./validateAesthetic";

// Reutiliza el perfil del test de composeTheme vía import del fixture builder
import { makeAesthetic, DARK } from "./testAestheticFixture";

const EMPTY_CTX: AestheticContext = {
  parameters: [],
  powers: [],
  badges: [],
  sets: {
    parameters: new Set(),
    branches: new Set(["off_branch_x"]),
    powers: new Set(),
    cards: new Set(),
    characters: new Set(),
  },
};

function codes(aesthetic: ReturnType<typeof makeAesthetic>, game?: Game): string[] {
  return validateAesthetic(aesthetic, game ?? makeGame({ aestheticId: aesthetic.id }), EMPTY_CTX).map((i) => i.code);
}

describe("validateAesthetic", () => {
  it("a complete valid profile produces no errors", () => {
    const aes = makeAesthetic();
    const issues = validateAesthetic(aes, { ...makeGame(), aestheticId: aes.id }, EMPTY_CTX);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("aestheticId mismatch → A_ID_MISMATCH", () => {
    const aes = makeAesthetic();
    expect(codes(aes, makeGame({ aestheticId: "off_other" }))).toContain("A_ID_MISMATCH");
  });

  it("font without fallback → A_FONT_MISSING", () => {
    const aes = makeAesthetic();
    aes.typography.fonts.body.fallback = [];
    expect(codes(aes)).toContain("A_FONT_MISSING");
  });

  it("self_hosted font without license → A_FONT_MISSING", () => {
    const aes = makeAesthetic();
    aes.typography.fonts.body = { ...aes.typography.fonts.body, source: "self_hosted", url: "/f.woff2" };
    expect(codes(aes)).toContain("A_FONT_MISSING");
  });

  it("low-contrast scheme → A_CONTRAST", () => {
    const aes = makeAesthetic();
    aes.tokens.dark = { ...DARK, textPrimary: "#12141a" }; // igual al fondo
    expect(codes(aes)).toContain("A_CONTRAST");
  });

  it("unparseable color → A_COLOR_INVALID", () => {
    const aes = makeAesthetic();
    aes.tokens.dark = { ...DARK, accent: "notacolor" };
    expect(codes(aes)).toContain("A_COLOR_INVALID");
  });

  it("scale weight not declared in the role font → A_SCALE_WEIGHT", () => {
    const aes = makeAesthetic();
    aes.typography.scale.title = { ...aes.typography.scale.title, weight: 300 };
    expect(codes(aes)).toContain("A_SCALE_WEIGHT");
  });

  it("override referencing a missing branch → A_OVERRIDE_INVALID", () => {
    const aes = makeAesthetic();
    aes.overrides = [
      { id: "ov", when: { type: "in_branch", branchId: "off_missing" }, colors: { accent: "#ff0000" } },
    ];
    expect(codes(aes)).toContain("A_OVERRIDE_INVALID");
  });

  it("override with bad colors or breaking contrast → A_OVERRIDE_INVALID", () => {
    const aes = makeAesthetic();
    aes.overrides = [
      { id: "ov1", when: { type: "in_branch", branchId: "off_branch_x" }, colors: { accent: "zzz" } },
      { id: "ov2", when: { type: "in_branch", branchId: "off_branch_x" }, colors: { textPrimary: "#12141a" } },
    ];
    const c = codes(aes);
    expect(c.filter((x) => x === "A_OVERRIDE_INVALID").length).toBeGreaterThanOrEqual(2);
  });

  it("valid override references pass", () => {
    const aes = makeAesthetic();
    // `border` no participa de los pares de contraste verificados
    aes.overrides = [
      { id: "ov", when: { type: "in_branch", branchId: "off_branch_x" }, colors: { border: "#3a4256" } },
    ];
    expect(codes(aes)).not.toContain("A_OVERRIDE_INVALID");
  });
});

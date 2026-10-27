import { describe, expect, it } from "vitest";
import { assembleGameContent } from "../domain/engine/content";
import { validateGameContent } from "../domain/engine/validation";
import { loadFixtureBundle } from "./loadFixtureBundle";

describe("fixture demo-reino", () => {
  it("ensambla contenido con cartas y pasa la validación sin errores", () => {
    const bundle = loadFixtureBundle();
    const content = assembleGameContent({ ...bundle, cards: bundle.cards });
    expect(content.cards.length).toBeGreaterThan(0);
    const errors = validateGameContent(content).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });
});

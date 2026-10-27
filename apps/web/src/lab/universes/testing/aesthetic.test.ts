import { describe, expect, it } from "vitest";

import { assembleGameContent } from "../domain/engine/content";
import { contrastRatio, meetsAA } from "../theme/contrast";
import { getPlatformColorScheme } from "../theme/platformTheme";
import { validateAesthetic, type AestheticContext } from "../theme/validateAesthetic";
import { loadAllBundles } from "./loadAllBundles";

function ctxFor(content: ReturnType<typeof assembleGameContent>): AestheticContext {
  return {
    parameters: content.parameters,
    powers: content.powers,
    badges: content.badges,
    sets: {
      parameters: new Set(content.parameters.map((p) => p.id)),
      branches: new Set(content.branches.map((b) => b.id)),
      powers: new Set(content.powers.map((p) => p.id)),
      cards: new Set(content.cards.map((c) => c.id)),
      characters: new Set(content.characters.map((c) => c.id)),
    },
  };
}

describe("validación estética del contenido", () => {
  for (const bundle of loadAllBundles()) {
    it(`${bundle.origin}/${bundle.slug}`, () => {
      const content = assembleGameContent(bundle.raw);
      const issues = validateAesthetic(content.aesthetic, content.game, ctxFor(content));
      const errors = issues.filter((i) => i.severity === "error");
      if (content.game.status === "published") {
        expect(
          errors.map((e) => `${e.code} @ ${e.path}`),
          `${bundle.slug}: errores estéticos`,
        ).toEqual([]);
      } else if (issues.length > 0) {
        console.warn(
          `${bundle.slug} issues:`,
          issues.map((i) => `${i.severity}:${i.code} @ ${i.path}`),
        );
      }
    });
  }

  it("el tema de plataforma cumple AA en los pares principales", () => {
    const s = getPlatformColorScheme();
    expect(meetsAA(contrastRatio(s.textPrimary, s.background), "normal")).toBe(true);
    expect(meetsAA(contrastRatio(s.textPrimary, s.surface), "normal")).toBe(true);
    expect(meetsAA(contrastRatio(s.textSecondary, s.surface), "normal")).toBe(true);
    expect(meetsAA(contrastRatio(s.accentContrast, s.accent), "normal")).toBe(true);
  });
});

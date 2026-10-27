import { describe, expect, it } from "vitest";

import type { ColorScheme } from "../domain/models";

import { contrastRatio, meetsAA } from "./contrast";
import { getPlatformColorScheme, getPlatformDesignValues } from "./platformTheme";

describe("getPlatformColorScheme", () => {
  it("returns every ColorScheme field as a non-empty parseable string", () => {
    const scheme = getPlatformColorScheme();
    const keys: (keyof ColorScheme)[] = [
      "background", "surface", "surfaceAlt", "border", "textPrimary",
      "textSecondary", "accent", "accentContrast", "positive",
      "negative", "warning", "info", "overlay",
    ];
    for (const key of keys) {
      expect(scheme[key].length, key).toBeGreaterThan(0);
    }
  });

  it("meets WCAG AA on the core pairs", () => {
    const s = getPlatformColorScheme();
    expect(meetsAA(contrastRatio(s.textPrimary, s.background), "normal")).toBe(true);
    expect(meetsAA(contrastRatio(s.textPrimary, s.surface), "normal")).toBe(true);
    expect(meetsAA(contrastRatio(s.accentContrast, s.accent), "normal")).toBe(true);
  });
});

describe("getPlatformDesignValues", () => {
  it("provides fonts, scale and motion without colors", () => {
    const d = getPlatformDesignValues();
    expect(d.fonts.display).toContain("Spectral");
    expect(d.scale.title.size).toBeGreaterThan(0);
    expect(d.motion.durationFast).toBeLessThan(d.motion.durationSlow);
    expect(d.spacingUnit).toBeGreaterThan(0);
  });
});

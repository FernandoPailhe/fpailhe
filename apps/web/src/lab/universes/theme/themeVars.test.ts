import { describe, expect, it } from "vitest";

import { composeTheme } from "./composeTheme";
import { getPlatformColorScheme } from "./platformTheme";
import { themeToCssVars } from "./themeVars";

describe("themeToCssVars", () => {
  const vars = themeToCssVars(composeTheme({ aesthetic: undefined, activeOverrides: [] }, undefined));
  const platform = getPlatformColorScheme();

  it("contains all ColorScheme vars with kebab-case names", () => {
    expect(vars["--uv-color-background"]).toBe(platform.background);
    expect(vars["--uv-color-surface-alt"]).toBe(platform.surfaceAlt);
    expect(vars["--uv-color-text-primary"]).toBe(platform.textPrimary);
    expect(vars["--uv-color-accent-contrast"]).toBe(platform.accentContrast);
  });

  it("contains font, type scale, radius, shadows and motion vars", () => {
    expect(vars["--uv-font-display"]).toContain("Spectral");
    expect(vars["--uv-type-title-size"]).toMatch(/px$/);
    expect(vars["--uv-type-card-text-lh"]).toBeTruthy();
    expect(vars["--uv-type-option-weight"]).toBeTruthy();
    expect(vars["--uv-type-number-font"]).toBeTruthy();
    expect(vars["--uv-radius-md"]).toMatch(/px$/);
    expect(vars["--uv-border-width"]).toMatch(/px$/);
    expect(vars["--uv-space"]).toMatch(/px$/);
    expect(vars["--uv-shadow-card"]).toBeTruthy();
    expect(vars["--uv-motion-base"]).toMatch(/ms$/);
    expect(vars["--uv-easing"]).toBeTruthy();
    expect(vars["--uv-card-transition"]).toBe("fade");
  });

  it("never produces an empty value", () => {
    for (const [key, value] of Object.entries(vars)) {
      expect(value.length, key).toBeGreaterThan(0);
    }
  });
});

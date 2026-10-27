import { describe, expect, it } from "vitest";

import type { ThemeInput } from "../application/types";
import type { AestheticProfile, ThemeOverride } from "../domain/models";

import { composeTheme } from "./composeTheme";
import { getPlatformColorScheme } from "./platformTheme";
import { DARK, makeAesthetic } from "./testAestheticFixture";
import { themeToCssVars } from "./themeVars";

function input(aesthetic?: AestheticProfile, activeOverrides: ThemeOverride[] = []): ThemeInput {
  return { aesthetic, activeOverrides };
}

describe("composeTheme", () => {
  it("without aesthetic falls back entirely to the platform theme", () => {
    const t = composeTheme(input(), undefined);
    expect(t.scheme).toBe("light");
    expect(t.colors).toEqual(getPlatformColorScheme());
    expect(t.parameterColors).toEqual({});
    expect(t.fonts.body).toContain("Work Sans");
    expect(t.motion.cardTransition).toBe("fade");
  });

  it("with both schemes, prefersDark decides", () => {
    const aes = makeAesthetic();
    expect(composeTheme(input(aes), true).scheme).toBe("dark");
    expect(composeTheme(input(aes), false).scheme).toBe("light");
    expect(composeTheme(input(aes), true).colors.accent).toBe("#d4a94e");
  });

  it("with both schemes and no system preference, uses defaultScheme", () => {
    const t = composeTheme(input(makeAesthetic()), undefined);
    expect(t.scheme).toBe("dark"); // defaultScheme: "dark"
    expect(t.colors.background).toBe("#12141a");
  });

  it("with a single scheme, uses it regardless of preference", () => {
    const aes = makeAesthetic();
    aes.tokens.light = undefined;
    const t = composeTheme(input(aes), false);
    expect(t.scheme).toBe("dark");
    expect(t.colors.accent).toBe("#d4a94e");
  });

  it("invalid colors fall back to the platform value", () => {
    const aes = makeAesthetic();
    aes.tokens.dark = { ...DARK, accent: "not-a-color" };
    const t = composeTheme(input(aes), true);
    expect(t.colors.accent).toBe(getPlatformColorScheme().accent);
    expect(t.colors.background).toBe("#12141a");
  });

  it("applies active overrides in order; last cardTransition wins", () => {
    const aes = makeAesthetic();
    const overrides: ThemeOverride[] = [
      { id: "ov1", when: { type: "in_branch", branchId: "b" }, colors: { accent: "#ff0000" }, cardTransition: "stack" },
      { id: "ov2", when: { type: "in_branch", branchId: "b" }, colors: { accent: "#00ff00", border: "invalid" } },
    ];
    const t = composeTheme(input(aes, overrides), true);
    expect(t.colors.accent).toBe("#00ff00");
    expect(t.colors.border).toBe("#3a4256"); // override inválido ignorado
    expect(t.motion.cardTransition).toBe("stack");
  });

  it("builds font stacks with quoted family and fallbacks; accent falls back to body", () => {
    const aes = makeAesthetic();
    let t = composeTheme(input(aes), true);
    expect(t.fonts.display).toBe('"Display Serif", Georgia, serif');
    expect(t.fonts.accent).toBe('"Accent Mono", monospace');

    aes.typography.fonts.accent = undefined;
    t = composeTheme(input(aes), true);
    expect(t.fonts.accent).toBe('"Body Sans", system-ui, sans-serif');
  });

  it("maps scale roles to resolved families and keeps radius/motion", () => {
    const t = composeTheme(input(makeAesthetic()), true);
    expect(t.scale.number.family).toBe('"Accent Mono", monospace');
    expect(t.scale.label.uppercase).toBe(true);
    expect(t.radius.lg).toBe(16);
    expect(t.motion.durationSlow).toBe(400);
    expect(t.parameterColors).toEqual({ off_param_a: "#8a6a1e" });
  });
});

describe("acceptance: two profiles, two themes, no component changes", () => {
  it("different AestheticProfiles produce different css vars", () => {
    const a = composeTheme(input(makeAesthetic()), true);
    const b = composeTheme(input(makeAesthetic({ tokens: { ...makeAesthetic().tokens, dark: { ...DARK, accent: "#0044ff" } } })), true);
    const va = themeToCssVars(a);
    const vb = themeToCssVars(b);
    expect(va["--uv-color-accent"]).not.toBe(vb["--uv-color-accent"]);
  });
});

/**
 * Fixture de `AestheticProfile` para tests de `theme/` (no entra al build;
 * solo lo importan los *.test.ts del módulo).
 */
import type { AestheticProfile, ColorScheme } from "../domain/models";

export const DARK: ColorScheme = {
  background: "#12141a",
  surface: "#1a1e28",
  surfaceAlt: "#232938",
  border: "#3a4256",
  textPrimary: "#f2f4f8",
  textSecondary: "#b8c0d0",
  accent: "#d4a94e",
  accentContrast: "#1a1405",
  positive: "#5fce8a",
  negative: "#e0685f",
  warning: "#e5b45e",
  info: "#6db3e8",
  overlay: "#0a0c12cc",
};

export const LIGHT: ColorScheme = {
  background: "#f5f3ee",
  surface: "#ffffff",
  surfaceAlt: "#eceae2",
  border: "#c9c4b8",
  textPrimary: "#1c2028",
  textSecondary: "#4a5160",
  accent: "#7a5c12",
  accentContrast: "#fffdf5",
  positive: "#1e7a44",
  negative: "#b03428",
  warning: "#8a5f0e",
  info: "#1d5fa8",
  overlay: "#ffffffcc",
};

export function makeAesthetic(overrides: Partial<AestheticProfile> = {}): AestheticProfile {
  return {
    id: "off_aes_test",
    schemaVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    gameId: "off_game_test",
    key: "test",
    name: { default: "Test" },
    version: 1,
    artDirection: {
      styleSummary: "test",
      basePrompt: "test",
      negativePrompt: "",
      keywords: [],
      mood: [],
      paletteHint: "test",
      templates: {},
    },
    tokens: {
      defaultScheme: "dark",
      light: LIGHT,
      dark: DARK,
      parameterColors: { off_param_a: "#8a6a1e" },
      radius: { sm: 4, md: 8, lg: 16 },
      borderWidth: 2,
      spacingUnit: 10,
      shadows: { card: "0 1px 2px #000", modal: "0 2px 4px #000" },
      motion: { durationFast: 100, durationBase: 200, durationSlow: 400, easing: "ease-in-out", cardTransition: "flip" },
    },
    typography: {
      fonts: {
        display: { family: "Display Serif", source: "system", weights: [700], fallback: ["Georgia", "serif"] },
        body: { family: "Body Sans", source: "system", weights: [400, 500], fallback: ["system-ui", "sans-serif"] },
        accent: { family: "Accent Mono", source: "system", weights: [600], fallback: ["monospace"] },
      },
      scale: {
        title: { font: "display", size: 30, lineHeight: 1.2, weight: 700 },
        cardText: { font: "body", size: 18, lineHeight: 1.55, weight: 400 },
        option: { font: "body", size: 16, lineHeight: 1.4, weight: 500 },
        label: { font: "body", size: 13, lineHeight: 1.3, weight: 500, uppercase: true },
        number: { font: "accent", size: 15, lineHeight: 1.2, weight: 600 },
        caption: { font: "body", size: 11, lineHeight: 1.35, weight: 400 },
      },
    },
    iconStyle: { variant: "line", gridSize: 24, format: "svg", colorMode: "currentColor" },
    ...overrides,
  };
}

/**
 * Perfil estético alternativo **solo para tests** (task 08): colores,
 * fuentes, radios y `cardTransition` distintos a los de `demo-reino`.
 * Sirve para probar que el tema cambia solo por datos, sin tocar componentes.
 */
import type { AestheticProfile } from "../domain/models";

export const aestheticAlt: AestheticProfile = {
  id: "off_aes_alt_test",
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  gameId: "off_game_alt",
  key: "alt",
  name: { default: "Alternativo" },
  version: 1,
  artDirection: {
    styleSummary: "alt",
    basePrompt: "alt",
    negativePrompt: "",
    keywords: [],
    mood: [],
    paletteHint: "alt",
    templates: {},
  },
  tokens: {
    defaultScheme: "light",
    light: {
      background: "#eef4f8",
      surface: "#ffffff",
      surfaceAlt: "#dce8f0",
      border: "#9ab4c4",
      textPrimary: "#0e2432",
      textSecondary: "#3e5a6c",
      accent: "#0b6e4f",
      accentContrast: "#ffffff",
      positive: "#1e7a44",
      negative: "#b03428",
      warning: "#8a5f0e",
      info: "#1d5fa8",
      overlay: "#0e2432cc",
    },
    parameterColors: { off_param_tesoro: "#0b6e4f" },
    radius: { sm: 8, md: 16, lg: 24 },
    borderWidth: 3,
    spacingUnit: 12,
    shadows: { card: "0 4px 12px rgba(0,0,0,0.2)", modal: "0 8px 24px rgba(0,0,0,0.3)" },
    motion: {
      durationFast: 60,
      durationBase: 120,
      durationSlow: 240,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      cardTransition: "stack",
    },
  },
  typography: {
    fonts: {
      display: { family: "Alt Display", source: "system", weights: [700], fallback: ["serif"] },
      body: { family: "Alt Body", source: "system", weights: [400, 500], fallback: ["sans-serif"] },
      accent: { family: "Alt Mono", source: "system", weights: [600], fallback: ["monospace"] },
    },
    scale: {
      title: { font: "display", size: 34, lineHeight: 1.1, weight: 700 },
      cardText: { font: "body", size: 20, lineHeight: 1.6, weight: 400 },
      option: { font: "body", size: 15, lineHeight: 1.4, weight: 500 },
      label: { font: "body", size: 12, lineHeight: 1.3, weight: 500 },
      number: { font: "accent", size: 14, lineHeight: 1.2, weight: 600 },
      caption: { font: "body", size: 10, lineHeight: 1.4, weight: 400 },
    },
  },
  iconStyle: { variant: "pixel", gridSize: 16, format: "png", colorMode: "fixed" },
};

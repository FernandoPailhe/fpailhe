import type { ThemeTokens } from "./tokens";

/**
 * Tema oscuro: mismo shape que `themeTokens`, con la base y el texto
 * invertidos. El acento terracota se mantiene; `goldBright` se aclara
 * para conservar contraste sobre superficies oscuras.
 */
export const darkTokens: ThemeTokens = {
  color: {
    // Base — monocromo cálido invertido (hue 75)
    canvas: "oklch(17% 0.010 75)",
    surface: "oklch(22% 0.012 75)",
    surfaceRaised: "oklch(25% 0.014 75)",
    line: "oklch(35% 0.010 75)",
    lineSoft: "oklch(30% 0.010 75)",

    // Texto
    ink: "oklch(94% 0.010 75)",
    inkDim: "oklch(75% 0.010 75)",
    inkFaint: "oklch(65% 0.010 75)",

    // Acento principal — terracotta
    gold: "#C1502E",
    goldBright: "#D96A44",
    goldSoft: "rgba(193, 80, 46, 0.18)",

    // Alertas / error
    crimson: "#e56c5e",
    crimsonBright: "#f48a7d",

    // Acentos secundarios (usados por PositionChip)
    silver: "oklch(75% 0.010 75)",
    silverSoft: "rgba(200, 200, 200, 0.10)",
    bronze: "oklch(75% 0.010 75)",
    bronzeSoft: "rgba(200, 200, 200, 0.10)",
    bronzeBright: "oklch(94% 0.010 75)",

    // Tablero de rugby-chess — la misma madera, un punto más apagada
    // para no competir con la página oscura
    pitch: "oklch(86% 0.040 80.8)",
    pitchAlt: "oklch(62% 0.055 64.7)",

    // Superficie invertida (footer/contacto): en dark se vuelve clara
    parchment: "oklch(94% 0.010 75)",
    parchmentRaised: "oklch(90% 0.012 75)",
    parchmentInk: "oklch(17% 0.010 75)",
    parchmentInkDim: "oklch(35% 0.010 75)",
    parchmentLine: "oklch(80% 0.010 75)",
  },
  font: {
    display: "'Spectral', Georgia, serif",
    ui: "'Work Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
  },
  radius: {
    sm: "0px",
    md: "0px",
    lg: "0px",
    pill: "999px",
  },
};

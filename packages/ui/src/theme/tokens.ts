/**
 * Fuente única de verdad del theme visual de la app.
 *
 * Para recolorear o retipografiar el sitio entero, este es el único
 * archivo que hace falta tocar: `ThemeProvider` vuelca estos valores
 * como variables CSS en `:root`, y `tailwind.config.ts` (en apps/web)
 * genera las clases de utilidad (`bg-canvas`, `text-gold`, `font-display`,
 * `rounded-lg`, ...) a partir del mismo objeto — ver `theme/cssVariables.ts`.
 *
 * Los colores por-entidad de dominio NO van acá: son datos, no parte
 * del theme (ver @ferpa/data-model). El tema oscuro vive en
 * `darkTokens.ts` con las mismas claves.
 */

export const themeTokens = {
  color: {
    // Base — monocromo cálido, light-first (hue 75)
    canvas: "oklch(97% 0.012 75)",
    surface: "oklch(99% 0.006 75)",
    surfaceRaised: "oklch(99% 0.006 75)",
    line: "oklch(86% 0.010 75)",
    lineSoft: "oklch(88% 0.010 75)",

    // Texto
    ink: "oklch(17% 0.010 75)",
    inkDim: "oklch(45% 0.010 75)",
    inkFaint: "oklch(48% 0.010 75)",

    // Acento principal — terracotta
    gold: "#C1502E",
    goldBright: "#B2472C",
    goldSoft: "rgba(193, 80, 46, 0.14)",

    // Alertas / error
    crimson: "#b3271f",
    crimsonBright: "#d84a3d",

    // Acentos secundarios (en uso por PositionChip: podios 2° y 3°)
    silver: "oklch(45% 0.010 75)",
    silverSoft: "rgba(69, 69, 69, 0.08)",
    bronze: "oklch(45% 0.010 75)",
    bronzeSoft: "rgba(69, 69, 69, 0.08)",
    bronzeBright: "oklch(17% 0.010 75)",

    // Tablero de rugby-chess — verdes de cancha (luminosidad media:
    // deben convivir pieza negra e invertida sobre ambos tonos)
    pitch: "oklch(55% 0.13 150)",
    pitchAlt: "oklch(47% 0.12 150)",

    // Superficie invertida (footer/contacto)
    parchment: "oklch(17% 0.010 75)",
    parchmentRaised: "oklch(20% 0.010 75)",
    parchmentInk: "oklch(94% 0.010 75)",
    parchmentInkDim: "oklch(80% 0.010 75)",
    parchmentLine: "oklch(35% 0.010 75)",
  },
  font: {
    // Titulares
    display: "'Spectral', Georgia, serif",
    // Interfaz, navegación, datos
    ui: "'Work Sans', system-ui, sans-serif",
    // Numérica, código, metadatos
    mono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
  },
  radius: {
    sm: "0px",
    md: "0px",
    lg: "0px",
    pill: "999px",
  },
} as const;

/**
 * `themeTokens` está `as const`, así que `typeof` produce tipos literales.
 * `ThemeTokens` los amplía a `string` en las hojas para que un tema
 * alternativo (ej. `darkTokens`) pueda declararse con otros valores
 * manteniendo exactamente las mismas claves.
 */
type StringLeaves<T> = {
  [K in keyof T]: T[K] extends string ? string : StringLeaves<T[K]>;
};

export type ThemeTokens = StringLeaves<typeof themeTokens>;
export type ThemeColorToken = keyof ThemeTokens["color"];
export type ThemeFontToken = keyof ThemeTokens["font"];
export type ThemeRadiusToken = keyof ThemeTokens["radius"];

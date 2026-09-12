/**
 * Fuente única de verdad del theme visual de la app.
 *
 * Para recolorear o retipografiar el sitio entero, este es el único
 * archivo que hace falta tocar: `ThemeProvider` vuelca estos valores
 * como variables CSS en `:root`, y `tailwind.config.ts` (en apps/web)
 * genera las clases de utilidad (`bg-canvas`, `text-gold`, `font-display`,
 * `rounded-lg`, ...) a partir del mismo objeto — ver `theme/cssVariables.ts`.
 *
 * TEMPLATE: Editá los valores de abajo para adaptar la estética a tu
 * proyecto. Los colores por-entidad de dominio NO van acá: son datos,
 * no parte del theme (ver @ferpa/data-model).
 */

export const themeTokens = {
  color: {
    // Base
    canvas: "#0a0c10",
    surface: "#12151b",
    surfaceRaised: "#181c24",
    line: "#262b35",
    lineSoft: "#1c2029",

    // Texto
    ink: "#ece8de",
    inkDim: "#9aa0ac",
    inkFaint: "#5b616d",

    // Acento principal
    gold: "#cba135",
    goldBright: "#e6c568",
    goldSoft: "rgba(203,161,53,0.14)",

    // Alertas / error
    crimson: "#b3271f",
    crimsonBright: "#d84a3d",

    // Acentos secundarios
    silver: "#a9adb4",
    silverSoft: "rgba(169,173,180,0.12)",
    bronze: "#a5723f",
    bronzeSoft: "rgba(165,114,63,0.14)",
    bronzeBright: "#d0a578",

    // Superficie clara (modales, overlays, etc.)
    parchment: "#efe6cc",
    parchmentRaised: "#f6efdb",
    parchmentInk: "#2a2013",
    parchmentInkDim: "#6b5c3c",
    parchmentLine: "#cfbd8c",
  },
  font: {
    // Titulares
    display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
    // Interfaz, navegación, datos
    ui: "'Titillium Web', 'Segoe UI', system-ui, sans-serif",
    // Numérica, código
    mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
  },
  radius: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    pill: "999px",
  },
} as const;

export type ThemeTokens = typeof themeTokens;
export type ThemeColorToken = keyof ThemeTokens["color"];
export type ThemeFontToken = keyof ThemeTokens["font"];
export type ThemeRadiusToken = keyof ThemeTokens["radius"];

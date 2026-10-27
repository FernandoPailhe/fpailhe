/**
 * Compone un `ThemeInput` (perfil estético + overrides activos) en un
 * `ResolvedTheme`: colores, fuentes, escala y motion resueltos y validados,
 * listos para volcarse a variables CSS con `themeToCssVars`.
 *
 * Reglas (ver plan de UI, decisión #2):
 * - Si el perfil define ambos esquemas y el sistema informa preferencia,
 *   se usa la del sistema; si no, `defaultScheme`; si el esquema elegido
 *   no existe, el otro; si el perfil no define ninguno, tema de plataforma.
 * - Cada color que no parsea cae al valor equivalente de plataforma.
 * - Los `activeOverrides` se aplican en orden; `cardTransition` gana el
 *   último override que lo defina.
 */
import type { ThemeInput } from "../application/types";
import type { ColorScheme, DesignTokens, FontFace, FontRole, ID, Typography } from "../domain/models";

import { parseColor } from "./contrast";
import { getPlatformColorScheme, getPlatformDesignValues } from "./platformTheme";

export interface ResolvedTheme {
  scheme: "light" | "dark";
  colors: ColorScheme;
  parameterColors: Record<ID, string>;
  /** font-family CSS ya armado con fallbacks */
  fonts: Record<FontRole, string>;
  scale: Record<keyof Typography["scale"], { family: string; size: number; lineHeight: number; weight: number; letterSpacing?: number; uppercase?: boolean }>;
  radius: DesignTokens["radius"];
  borderWidth: number;
  spacingUnit: number;
  shadows: { card: string; modal: string };
  motion: DesignTokens["motion"];
}

const COLOR_KEYS: readonly (keyof ColorScheme)[] = [
  "background",
  "surface",
  "surfaceAlt",
  "border",
  "textPrimary",
  "textSecondary",
  "accent",
  "accentContrast",
  "positive",
  "negative",
  "warning",
  "info",
  "overlay",
];

function fontStack(face: FontFace): string {
  const fallback = face.fallback.length > 0 ? `, ${face.fallback.join(", ")}` : "";
  return `"${face.family}"${fallback}`;
}

function sanitizeColors(scheme: ColorScheme | undefined, platform: ColorScheme): ColorScheme {
  const out = { ...platform };
  if (!scheme) return out;
  for (const key of COLOR_KEYS) {
    const value = scheme[key];
    if (typeof value === "string" && parseColor(value) !== null) out[key] = value;
  }
  return out;
}

export function composeTheme(input: ThemeInput, prefersDark: boolean | undefined): ResolvedTheme {
  const platformColors = getPlatformColorScheme();
  const platform = getPlatformDesignValues();

  const tokens = input.aesthetic?.tokens;
  const light = tokens?.light;
  const dark = tokens?.dark;

  let scheme: "light" | "dark";
  let baseScheme: ColorScheme | undefined;
  if (light !== undefined && dark !== undefined && prefersDark !== undefined) {
    scheme = prefersDark ? "dark" : "light";
    baseScheme = prefersDark ? dark : light;
  } else if (tokens?.defaultScheme === "dark" && dark !== undefined) {
    scheme = "dark";
    baseScheme = dark;
  } else if (light !== undefined) {
    scheme = "light";
    baseScheme = light;
  } else if (dark !== undefined) {
    scheme = "dark";
    baseScheme = dark;
  } else {
    scheme = platform.scheme;
    baseScheme = undefined;
  }

  const colors = sanitizeColors(baseScheme, platformColors);

  let cardTransition: DesignTokens["motion"]["cardTransition"] | undefined;
  for (const override of input.activeOverrides) {
    if (override.colors) {
      for (const key of COLOR_KEYS) {
        const value = override.colors[key];
        if (typeof value === "string" && parseColor(value) !== null) colors[key] = value;
      }
    }
    if (override.cardTransition !== undefined) cardTransition = override.cardTransition;
  }

  const parameterColors: Record<ID, string> = {};
  if (tokens?.parameterColors) {
    for (const [id, value] of Object.entries(tokens.parameterColors)) {
      if (parseColor(value) !== null) parameterColors[id] = value;
    }
  }

  const aestheticFonts = input.aesthetic?.typography.fonts;
  const fonts: Record<FontRole, string> = aestheticFonts
    ? {
        display: fontStack(aestheticFonts.display),
        body: fontStack(aestheticFonts.body),
        accent: aestheticFonts.accent !== undefined ? fontStack(aestheticFonts.accent) : fontStack(aestheticFonts.body),
      }
    : platform.fonts;

  const aestheticScale = input.aesthetic?.typography.scale;
  const scale = aestheticScale
    ? Object.fromEntries(
        (Object.keys(platform.scale) as (keyof Typography["scale"])[]).map((key) => {
          const style = aestheticScale[key];
          return [key, { family: fonts[style.font], size: style.size, lineHeight: style.lineHeight, weight: style.weight, letterSpacing: style.letterSpacing, uppercase: style.uppercase }];
        }),
      ) as ResolvedTheme["scale"]
    : platform.scale;

  const motion = tokens?.motion ?? platform.motion;

  return {
    scheme,
    colors,
    parameterColors,
    fonts,
    scale,
    radius: tokens?.radius ?? platform.radius,
    borderWidth: tokens?.borderWidth ?? platform.borderWidth,
    spacingUnit: tokens?.spacingUnit ?? platform.spacingUnit,
    shadows: {
      card: tokens?.shadows?.card ?? platform.shadows.card,
      modal: tokens?.shadows?.modal ?? platform.shadows.modal,
    },
    motion: { ...motion, cardTransition: cardTransition ?? motion.cardTransition },
  };
}

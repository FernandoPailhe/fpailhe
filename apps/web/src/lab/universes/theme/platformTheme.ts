/**
 * Tema de plataforma: el ColorScheme y los valores de diseño del sitio
 * (`@ferpa/ui`), usados como respaldo cuando un universo no define
 * `aesthetic` o cuando un color del perfil no parsea.
 */
import { themeTokens } from "@ferpa/ui";

import type { ColorScheme, DesignTokens, FontRole, Typography } from "../domain/models";

export function getPlatformColorScheme(): ColorScheme {
  const c = themeTokens.color;
  return {
    background: c.canvas,
    surface: c.surface,
    surfaceAlt: c.surfaceRaised,
    border: c.line,
    textPrimary: c.ink,
    textSecondary: c.inkDim,
    accent: c.gold,
    accentContrast: c.accentContrast,
    positive: c.positive,
    negative: c.negative,
    warning: c.warning,
    info: c.info,
    overlay: c.overlay,
  };
}

export interface PlatformDesignValues {
  scheme: "light" | "dark";
  fonts: Record<FontRole, string>;
  scale: Record<keyof Typography["scale"], { family: string; size: number; lineHeight: number; weight: number; letterSpacing?: number; uppercase?: boolean }>;
  radius: DesignTokens["radius"];
  borderWidth: number;
  spacingUnit: number;
  shadows: { card: string; modal: string };
  motion: DesignTokens["motion"];
}

/**
 * Valores de diseño por defecto del sitio. Los radios salen de `themeTokens`
 * (en px); el resto son números simples, sin colores.
 */
export function getPlatformDesignValues(): PlatformDesignValues {
  const f = themeTokens.font;
  const fonts: Record<FontRole, string> = {
    display: f.display,
    body: f.ui,
    accent: f.mono,
  };
  return {
    scheme: "light",
    fonts,
    scale: {
      title: { family: fonts.display, size: 30, lineHeight: 1.2, weight: 700 },
      cardText: { family: fonts.body, size: 18, lineHeight: 1.55, weight: 400 },
      option: { family: fonts.body, size: 16, lineHeight: 1.4, weight: 500 },
      label: { family: fonts.body, size: 13, lineHeight: 1.3, weight: 500 },
      number: { family: fonts.accent, size: 15, lineHeight: 1.2, weight: 600 },
      caption: { family: fonts.body, size: 11, lineHeight: 1.35, weight: 400 },
    },
    radius: { sm: 0, md: 0, lg: 0 },
    borderWidth: 1,
    spacingUnit: 8,
    shadows: {
      card: "0 8px 24px rgba(0, 0, 0, 0.12)",
      modal: "0 16px 48px rgba(0, 0, 0, 0.24)",
    },
    motion: {
      durationFast: 120,
      durationBase: 240,
      durationSlow: 420,
      easing: "ease-out",
      cardTransition: "fade",
    },
  };
}

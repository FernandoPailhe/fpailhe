import { themeTokens, type ThemeTokens } from "./tokens";

/** camelCase -> kebab-case, ej. "goldBright" -> "gold-bright". */
function toKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Aplana los tokens del theme en variables CSS (`--color-gold-bright`, etc.)
 * listas para escribir en `:root`. Usado por `ThemeProvider` en runtime.
 */
export function buildCssVariables(tokens: ThemeTokens = themeTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(tokens.color)) {
    vars[`--color-${toKebabCase(key)}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.font)) {
    vars[`--font-${toKebabCase(key)}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.radius)) {
    vars[`--radius-${toKebabCase(key)}`] = value;
  }

  return vars;
}

/**
 * Genera el mapa `theme.extend.colors` de Tailwind a partir de los mismos
 * tokens, apuntando cada clase a su variable CSS (no al valor literal), para
 * que un cambio de theme en runtime (o un theme alternativo) se refleje sin
 * recompilar. Se consume desde `apps/web/tailwind.config.ts`.
 */
export function buildTailwindColors(tokens: ThemeTokens = themeTokens): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const key of Object.keys(tokens.color)) {
    colors[toKebabCase(key)] = `var(--color-${toKebabCase(key)})`;
  }
  return colors;
}

export function buildTailwindFonts(tokens: ThemeTokens = themeTokens): Record<string, string[]> {
  const fonts: Record<string, string[]> = {};
  for (const key of Object.keys(tokens.font)) {
    fonts[toKebabCase(key)] = [`var(--font-${toKebabCase(key)})`];
  }
  return fonts;
}

export function buildTailwindRadius(tokens: ThemeTokens = themeTokens): Record<string, string> {
  const radii: Record<string, string> = {};
  for (const key of Object.keys(tokens.radius)) {
    radii[toKebabCase(key)] = `var(--radius-${toKebabCase(key)})`;
  }
  return radii;
}

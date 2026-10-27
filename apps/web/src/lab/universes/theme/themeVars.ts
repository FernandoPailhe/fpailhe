/**
 * Vuelca un `ResolvedTheme` a variables CSS `--uv-*` (diccionario plano,
 * listo para aplicar como `style` en `ThemeScope`).
 */
import type { ColorScheme, Typography } from "../domain/models";

import type { ResolvedTheme } from "./composeTheme";

function toKebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function sanitizeVarName(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

const SCALE_KEYS: readonly (keyof Typography["scale"])[] = [
  "title",
  "cardText",
  "option",
  "label",
  "number",
  "caption",
];

export function themeToCssVars(theme: ResolvedTheme): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const key of Object.keys(theme.colors) as (keyof ColorScheme)[]) {
    vars[`--uv-color-${toKebab(key)}`] = theme.colors[key];
  }

  for (const [id, value] of Object.entries(theme.parameterColors)) {
    vars[`--uv-param-${sanitizeVarName(id)}`] = value;
  }

  vars["--uv-font-display"] = theme.fonts.display;
  vars["--uv-font-body"] = theme.fonts.body;
  vars["--uv-font-accent"] = theme.fonts.accent;

  for (const key of SCALE_KEYS) {
    const style = theme.scale[key];
    const prefix = `--uv-type-${toKebab(key)}`;
    vars[`${prefix}-size`] = `${style.size}px`;
    vars[`${prefix}-lh`] = String(style.lineHeight);
    vars[`${prefix}-weight`] = String(style.weight);
    vars[`${prefix}-font`] = style.family;
    if (style.letterSpacing !== undefined) vars[`${prefix}-ls`] = `${style.letterSpacing}em`;
    if (style.uppercase === true) vars[`${prefix}-transform`] = "uppercase";
  }

  vars["--uv-radius-sm"] = `${theme.radius.sm}px`;
  vars["--uv-radius-md"] = `${theme.radius.md}px`;
  vars["--uv-radius-lg"] = `${theme.radius.lg}px`;
  vars["--uv-border-width"] = `${theme.borderWidth}px`;
  vars["--uv-space"] = `${theme.spacingUnit}px`;

  vars["--uv-shadow-card"] = theme.shadows.card;
  vars["--uv-shadow-modal"] = theme.shadows.modal;

  vars["--uv-motion-fast"] = `${theme.motion.durationFast}ms`;
  vars["--uv-motion-base"] = `${theme.motion.durationBase}ms`;
  vars["--uv-motion-slow"] = `${theme.motion.durationSlow}ms`;
  vars["--uv-easing"] = theme.motion.easing;
  vars["--uv-card-transition"] = theme.motion.cardTransition;

  return vars;
}

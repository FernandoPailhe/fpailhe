/**
 * Cadena de fallback de íconos (spec de estética §7):
 * 1. el ícono referenciado por `iconId` si tiene un `svg` que sanitiza;
 * 2. el primer ícono cuyos `semanticTags` intersecten `fallbackTags`;
 * 3. la inicial del nombre en un círculo.
 * Pura salvo el uso de `DOMParser` dentro de `sanitizeSvg`.
 */
import type { IconView } from "../application/types";
import type { ID } from "../domain/models";

import { sanitizeSvg } from "./sanitizeSvg";

export type ResolvedIcon =
  | { kind: "svg"; svg: string; label: string }
  | { kind: "initial"; initial: string; label: string };

export function resolveIcon(input: {
  iconId?: ID;
  fallbackTags: string[];
  name: string;
  icons: Record<ID, IconView>;
}): ResolvedIcon {
  const { iconId, fallbackTags, name, icons } = input;

  if (iconId !== undefined) {
    const icon = icons[iconId];
    if (icon?.svg !== undefined) {
      const svg = sanitizeSvg(icon.svg);
      if (svg !== null) return { kind: "svg", svg, label: icon.label };
    }
  }

  for (const icon of Object.values(icons)) {
    if (icon.svg === undefined) continue;
    if (!icon.semanticTags.some((tag) => fallbackTags.includes(tag))) continue;
    const svg = sanitizeSvg(icon.svg);
    if (svg !== null) return { kind: "svg", svg, label: icon.label };
  }

  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return { kind: "initial", initial, label: name };
}

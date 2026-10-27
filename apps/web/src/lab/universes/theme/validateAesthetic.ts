/**
 * Validación estética en build (`universes:validate`): reglas de §8 de la
 * spec aplicables al runtime — ids coherentes, fuentes con fallback, pesos
 * declarados, colores parseables, contraste AA por esquema (y tras cada
 * `ThemeOverride`) e iconografía/parámetros coloreados (warnings).
 * Pura: solo usa `contrast.ts` y los tipos del dominio.
 */
import type { ValidationIssue } from "../domain/engine/types";
import type {
  AestheticProfile,
  ColorScheme,
  Condition,
  FontFace,
  Game,
  ID,
  Parameter,
  Power,
  Badge,
} from "../domain/models";

import { contrastRatio, parseColor } from "./contrast";

export interface AestheticContext {
  parameters: Parameter[];
  powers: Power[];
  badges: Badge[];
  /** Ids válidos para revisar las referencias de `ThemeOverride.when`. */
  sets: {
    parameters: ReadonlySet<ID>;
    branches: ReadonlySet<ID>;
    powers: ReadonlySet<ID>;
    cards: ReadonlySet<ID>;
    characters: ReadonlySet<ID>;
  };
}

type Sink = (issue: ValidationIssue) => void;

function error(sink: Sink, code: string, path: string, message: string): void {
  sink({ severity: "error", code, path, message });
}

function warn(sink: Sink, code: string, path: string, message: string): void {
  sink({ severity: "warning", code, path, message });
}

const COLOR_KEYS: readonly (keyof ColorScheme)[] = [
  "background", "surface", "surfaceAlt", "border", "textPrimary",
  "textSecondary", "accent", "accentContrast", "positive",
  "negative", "warning", "info", "overlay",
];

function checkConditionRefs(
  sink: Sink,
  condition: Condition,
  sets: AestheticContext["sets"],
  path: string,
): void {
  switch (condition.type) {
    case "all":
    case "any":
      condition.conditions.forEach((c, i) =>
        checkConditionRefs(sink, c, sets, `${path}.conditions[${i}]`),
      );
      return;
    case "not":
      checkConditionRefs(sink, condition.condition, sets, `${path}.condition`);
      return;
    case "parameter":
      if (!sets.parameters.has(condition.parameterId)) {
        error(sink, "A_OVERRIDE_INVALID", path, `parameterId inexistente: ${condition.parameterId}`);
      }
      return;
    case "in_branch":
      if (!sets.branches.has(condition.branchId)) {
        error(sink, "A_OVERRIDE_INVALID", path, `branchId inexistente: ${condition.branchId}`);
      }
      return;
    case "has_power":
      if (!sets.powers.has(condition.powerId)) {
        error(sink, "A_OVERRIDE_INVALID", path, `powerId inexistente: ${condition.powerId}`);
      }
      return;
    case "character_unlocked":
      if (!sets.characters.has(condition.characterId)) {
        error(sink, "A_OVERRIDE_INVALID", path, `characterId inexistente: ${condition.characterId}`);
      }
      return;
    case "card_seen":
      if (!sets.cards.has(condition.cardId)) {
        error(sink, "A_OVERRIDE_INVALID", path, `cardId inexistente: ${condition.cardId}`);
      }
      return;
    default:
      return;
  }
}

function checkFont(sink: Sink, face: FontFace | undefined, role: string, path: string): void {
  if (face === undefined) {
    error(sink, "A_FONT_MISSING", path, `falta la fuente ${role}`);
    return;
  }
  if (face.fallback.length === 0) {
    error(sink, "A_FONT_MISSING", `${path}.fallback`, `la fuente ${role} no declara fallback`);
  }
  if (face.source === "self_hosted" && (face.url === undefined || face.license === undefined)) {
    error(
      sink,
      "A_FONT_MISSING",
      path,
      `fuente self_hosted ${role} sin ${face.url === undefined ? "url" : "license"}`,
    );
  }
}

function checkSchemeContrast(sink: Sink, scheme: ColorScheme, path: string): void {
  const pairs: [keyof ColorScheme, keyof ColorScheme][] = [
    ["textPrimary", "background"],
    ["textPrimary", "surface"],
    ["textSecondary", "surface"],
    ["accentContrast", "accent"],
  ];
  for (const [fg, bg] of pairs) {
    const ratio = contrastRatio(scheme[fg], scheme[bg]);
    if (ratio !== null && ratio < 4.5) {
      error(
        sink,
        "A_CONTRAST",
        `${path}.${fg}`,
        `contraste ${fg}/${bg} = ${ratio.toFixed(2)} < 4.5 (AA)`,
      );
    }
  }
}

export function validateAesthetic(
  aesthetic: AestheticProfile | undefined,
  game: Game,
  ctx: AestheticContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sink: Sink = (i) => issues.push(i);
  if (aesthetic === undefined) return issues;

  const path = `aesthetic[${aesthetic.id}]`;

  if (game.aestheticId !== aesthetic.id) {
    error(
      sink,
      "A_ID_MISMATCH",
      "game.aestheticId",
      `game.aestheticId ${game.aestheticId} ≠ aesthetic.id ${aesthetic.id}`,
    );
  }

  const fonts = aesthetic.typography.fonts;
  checkFont(sink, fonts.display, "display", `${path}.typography.fonts.display`);
  checkFont(sink, fonts.body, "body", `${path}.typography.fonts.body`);
  if (fonts.accent !== undefined) {
    checkFont(sink, fonts.accent, "accent", `${path}.typography.fonts.accent`);
  }

  for (const [key, style] of Object.entries(aesthetic.typography.scale)) {
    // Si falta el rol accent, el runtime cae a body (ver composeTheme)
    const face = fonts[style.font] ?? fonts.body;
    if (face !== undefined && !face.weights.includes(style.weight)) {
      error(
        sink,
        "A_SCALE_WEIGHT",
        `${path}.typography.scale.${key}.weight`,
        `weight ${style.weight} no declarado en fonts.${style.font}.weights`,
      );
    }
  }

  const tokens = aesthetic.tokens;
  for (const schemeName of ["light", "dark"] as const) {
    const scheme = tokens[schemeName];
    if (scheme === undefined) continue;
    const schemePath = `${path}.tokens.${schemeName}`;
    for (const key of COLOR_KEYS) {
      if (parseColor(scheme[key]) === null) {
        error(sink, "A_COLOR_INVALID", `${schemePath}.${key}`, `color no parseable: "${scheme[key]}"`);
      }
    }
    checkSchemeContrast(sink, scheme, schemePath);
    if (tokens.parameterColors !== undefined) {
      for (const [id, value] of Object.entries(tokens.parameterColors)) {
        if (parseColor(value) === null) {
          error(sink, "A_COLOR_INVALID", `${schemePath}.parameterColors.${id}`, `color no parseable: "${value}"`);
          continue;
        }
        const ratio = contrastRatio(value, scheme.surface);
        if (ratio !== null && ratio < 3) {
          error(
            sink,
            "A_CONTRAST",
            `${schemePath}.parameterColors.${id}`,
            `parámetro ${id} contra surface = ${ratio.toFixed(2)} < 3`,
          );
        }
      }
    }
  }

  for (const [i, override] of (aesthetic.overrides ?? []).entries()) {
    const oPath = `${path}.overrides[${i}]`;
    checkConditionRefs(sink, override.when, ctx.sets, `${oPath}.when`);
    if (override.colors !== undefined) {
      for (const key of COLOR_KEYS) {
        const value = override.colors[key];
        if (value !== undefined && parseColor(value) === null) {
          error(sink, "A_OVERRIDE_INVALID", `${oPath}.colors.${key}`, `color no parseable: "${value}"`);
        }
      }
      // Contraste del esquema con el override aplicado
      for (const schemeName of ["light", "dark"] as const) {
        const base = tokens[schemeName];
        if (base === undefined) continue;
        const merged = { ...base, ...override.colors };
        for (const [fg, bg] of [["textPrimary", "background"], ["accentContrast", "accent"]] as const) {
          const ratio = contrastRatio(merged[fg], merged[bg]);
          if (ratio !== null && ratio < 4.5) {
            error(
              sink,
              "A_OVERRIDE_INVALID",
              `${oPath}.colors.${fg}`,
              `override en ${schemeName}: contraste ${fg}/${bg} = ${ratio.toFixed(2)} < 4.5`,
            );
          }
        }
      }
    }
  }

  for (const p of ctx.parameters) {
    if (p.iconId === undefined) {
      warn(sink, "A_NO_ICON", `parameters[${p.id}].iconId`, "parámetro sin iconId");
    }
    if (tokens.parameterColors?.[p.id] === undefined) {
      warn(sink, "A_PARAM_COLOR", `parameters[${p.id}]`, "parámetro sin color en parameterColors");
    }
  }
  for (const p of ctx.powers) {
    if (p.iconId === undefined) {
      warn(sink, "A_NO_ICON", `powers[${p.id}].iconId`, "poder sin iconId");
    }
  }
  for (const b of ctx.badges) {
    if (b.iconId === undefined) {
      warn(sink, "A_NO_ICON", `badges[${b.id}].iconId`, "insignia sin iconId");
    }
  }

  return issues;
}

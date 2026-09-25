import {
  PIECE_MOVEMENT_CONFIG,
  Player,
  type PieceMovementConfig,
  type PieceMovementConfigMap,
} from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { GAME_RULES } from "../../domain/constants/GameRules";
import { buildRulesView, type RulesSource } from "../../domain/config/RulesView";
import { generateRandomArmy } from "../../domain/rules/randomArmy";
import { MovementRuleEngine } from "../../application/rules/MovementRuleEngine";
import { createSeededRng } from "../../application/ai/rng";
import type { RuleVariant } from "../../application/ai/testing/ruleVariants";

/**
 * Variante de reglas declarada por datos en un experimento JSON. `board` pisa
 * las dimensiones, `rules` los contadores de GAME_RULES y `pieces` es un parche
 * profundo por tipo sobre PIECE_MOVEMENT_CONFIG. Este módulo puede importar las
 * constantes del dominio (no está bajo el lint de `application/ai/**`).
 */
/** Parcial profundo: cada nivel de objeto es opcional (para parches de config). */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export interface RuleOverride {
  variant: string;
  board?: Partial<{ BOARD_WIDTH: number; BOARD_HEIGHT: number }>;
  rules?: Partial<RulesSource>;
  pieces?: Partial<Record<string, DeepPartial<PieceMovementConfig>>>;
}

const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Merge profundo: los objetos se combinan; arrays y escalares se reemplazan. */
export function mergeDeep<T>(base: T, patch: unknown): T {
  if (isPlainObj(base) && isPlainObj(patch)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = mergeDeep(base[k], v);
    }
    return out as T;
  }
  return patch === undefined ? base : (patch as T);
}

/** Construye la variante { name, rules, engine } desde un override. */
export function buildVariant(o: RuleOverride): RuleVariant {
  const board = {
    BOARD_WIDTH: o.board?.BOARD_WIDTH ?? GAME_CONFIG.BOARD_WIDTH,
    BOARD_HEIGHT: o.board?.BOARD_HEIGHT ?? GAME_CONFIG.BOARD_HEIGHT,
  };
  const rules = buildRulesView(board, { ...GAME_RULES, ...o.rules });
  const config = mergeDeep(
    structuredClone(PIECE_MOVEMENT_CONFIG) as PieceMovementConfigMap,
    o.pieces ?? {},
  );
  return { name: o.variant, rules, engine: new MovementRuleEngine(config) };
}

const RULE_KEYS: readonly (keyof RulesSource)[] = [
  "PIECES_TO_PLACE",
  "PIECES_IN_BENCH",
  "MIN_PIECES_PER_TYPE",
  "MAX_PIECES_PER_TYPE",
  "MAX_PIECES_PER_ROW",
  "POINTS_TO_WIN",
  "PLACEMENT_DEPTH",
];

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/**
 * Valida un override y devuelve la lista de errores (vacía = válido).
 * Prueba `generateRandomArmy` una vez por jugador: si las reglas resultantes
 * son imposibles de satisfacer, lo reporta con el mensaje del dominio.
 */
export function validateRuleOverride(o: unknown, label: string): string[] {
  const errors: string[] = [];
  if (!isPlainObj(o)) return [`${label}: no es objeto`];
  if (typeof o.variant !== "string" || o.variant === "") {
    errors.push(`${label}.variant: falta nombre`);
  }
  if (o.board !== undefined) {
    if (!isPlainObj(o.board)) {
      errors.push(`${label}.board: no es objeto`);
    } else {
      for (const k of ["BOARD_WIDTH", "BOARD_HEIGHT"] as const) {
        const v = o.board[k];
        if (v !== undefined && (!isInt(v) || v < 2)) {
          errors.push(`${label}.board.${k}: debe ser entero ≥2`);
        }
      }
    }
  }
  if (o.rules !== undefined) {
    if (!isPlainObj(o.rules)) {
      errors.push(`${label}.rules: no es objeto`);
    } else {
      for (const k of Object.keys(o.rules)) {
        if (!RULE_KEYS.includes(k as keyof RulesSource)) {
          errors.push(`${label}.rules.${k}: clave desconocida`);
          continue;
        }
        const v = o.rules[k];
        if (!isInt(v) || v <= 0) errors.push(`${label}.rules.${k}: debe ser entero >0`);
      }
    }
  }
  if (o.pieces !== undefined) {
    if (!isPlainObj(o.pieces)) {
      errors.push(`${label}.pieces: no es objeto`);
    } else {
      for (const t of Object.keys(o.pieces)) {
        if (!(t in PIECE_MOVEMENT_CONFIG)) {
          errors.push(`${label}.pieces.${t}: tipo desconocido`);
        }
      }
    }
  }
  if (errors.length) return errors;

  // Factibilidad real: si las reglas no admiten un ejército, falla claro acá.
  try {
    const variant = buildVariant(o as unknown as RuleOverride);
    const rng = createSeededRng(1);
    generateRandomArmy(variant.rules, Player.BLANCAS, rng);
    generateRandomArmy(variant.rules, Player.NEGRAS, rng);
  } catch (err) {
    errors.push(`${label}: ${(err as Error).message}`);
  }
  return errors;
}

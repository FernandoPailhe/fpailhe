import { PieceType } from "../constants/PieceConstants";
import type { RulesView } from "../config/RulesView";

/** Cantidad de piezas elegidas por tipo (tablero + banca). */
export type TypeCounts = Record<PieceType, number>;

export function emptyCounts(rules: RulesView): TypeCounts {
  const counts = {} as TypeCounts;
  for (const type of rules.pieceTypes) counts[type] = 0;
  return counts;
}

export function countsOf(types: readonly PieceType[], rules: RulesView): TypeCounts {
  const counts = emptyCounts(rules);
  for (const type of types) counts[type] += 1;
  return counts;
}

/**
 * ¿Queda un ejército posible con estos counts y `remainingSlots` por llenar?
 * Vale si ningún tipo supera el máximo, el faltante total para los mínimos
 * entra en los slots restantes y la capacidad restante los cubre.
 */
export function isCompositionFeasible(
  counts: TypeCounts,
  remainingSlots: number,
  rules: RulesView,
): boolean {
  if (remainingSlots < 0) return false;
  let missing = 0;
  let capacity = 0;
  for (const type of rules.pieceTypes) {
    const count = counts[type];
    if (count > rules.maxPerType) return false;
    missing += Math.max(0, rules.minPerType - count);
    capacity += rules.maxPerType - count;
  }
  return missing <= remainingSlots && capacity >= remainingSlots;
}

/**
 * Tipos que se pueden elegir sin dejar el ejército sin salida: agregar uno
 * de cada candidato debe seguir siendo factible para `remainingSlots − 1`.
 */
export function feasibleTypes(
  counts: TypeCounts,
  remainingSlots: number,
  rules: RulesView,
): PieceType[] {
  if (remainingSlots <= 0) return [];
  return rules.pieceTypes.filter((type) =>
    isCompositionFeasible({ ...counts, [type]: counts[type] + 1 }, remainingSlots - 1, rules),
  );
}

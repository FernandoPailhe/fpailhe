import { PieceType, Player } from "../constants/PieceConstants";
import { Position } from "../entities/Position";
import type { RulesView } from "../config/RulesView";
import { emptyCounts, feasibleTypes } from "./composition";

/** Ejército válido generado: piezas de tablero con casilla + tipos de banca. */
export interface GeneratedArmy {
  boardPieces: { type: PieceType; position: Position }[];
  benchPieces: PieceType[];
}

const pickIndex = <T>(arr: readonly T[], rng: () => number): T | undefined =>
  arr[Math.floor(rng() * arr.length)];

/**
 * Genera un ejército válido para `player` bajo `rules`: `piecesToPlace`
 * piezas en sus filas de despliegue (≤ maxPerRow por fila) + `benchSize`
 * tipos de banca, siempre con composición factible (mínimos y máximos por
 * tipo). Lanza solo si las reglas son imposibles de satisfacer.
 */
export function generateRandomArmy(
  rules: RulesView,
  player: Player,
  rng: () => number,
): GeneratedArmy {
  const totalSlots = rules.piecesToPlace + rules.benchSize;
  const counts = emptyCounts(rules);
  const boardPieces: GeneratedArmy["boardPieces"] = [];
  const occupied = new Set<string>();
  const rowOccupancy = new Map<number, number>();

  const pickType = (placedSoFar: number): PieceType => {
    const allowed = feasibleTypes(counts, totalSlots - placedSoFar, rules);
    const type = pickIndex(allowed, rng);
    if (type === undefined) {
      throw new Error(
        `reglas imposibles: no hay tipo factible con ${placedSoFar} piezas ` +
          `elegidas de ${totalSlots} (min ${rules.minPerType}, max ${rules.maxPerType}, ` +
          `${rules.pieceTypes.length} tipos)`,
      );
    }
    counts[type] += 1;
    return type;
  };

  const freeSquares = (): Position[] => {
    const squares: Position[] = [];
    for (const row of rules.placementRows(player)) {
      if ((rowOccupancy.get(row) ?? 0) >= rules.maxPerRow) continue;
      for (let x = 0; x < rules.width; x++) {
        if (!occupied.has(`${x},${row}`)) squares.push(new Position(x, row));
      }
    }
    return squares;
  };

  for (let i = 0; i < rules.piecesToPlace; i++) {
    const type = pickType(i);
    const squares = freeSquares();
    const position = pickIndex(squares, rng);
    if (position === undefined) {
      throw new Error(
        `reglas imposibles: no queda casilla de despliegue para la pieza ` +
          `${i + 1} de ${rules.piecesToPlace} (${rules.placementRows(player).length} filas ` +
          `× ${rules.width} cols, max ${rules.maxPerRow} por fila)`,
      );
    }
    occupied.add(`${position.x},${position.y}`);
    rowOccupancy.set(position.y, (rowOccupancy.get(position.y) ?? 0) + 1);
    boardPieces.push({ type, position });
  }

  const benchPieces: PieceType[] = [];
  for (let i = 0; i < rules.benchSize; i++) {
    benchPieces.push(pickType(rules.piecesToPlace + i));
  }

  return { boardPieces, benchPieces };
}

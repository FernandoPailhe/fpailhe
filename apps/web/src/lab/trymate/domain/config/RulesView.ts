import { PieceType, Player } from "../constants/PieceConstants";
import { GAME_CONFIG } from "../constants/GameConstants";
import { GAME_RULES } from "../constants/GameRules";

/**
 * Vista de solo lectura de las reglas vigentes: la única fuente que consumen
 * store, motor, bots y textos. Deriva filas de despliegue, fila base, fila de
 * anotación y dirección de avance del tamaño del tablero + PLACEMENT_DEPTH, así
 * un cambio de reglas se hace en un solo lugar.
 */
export interface RulesView {
  readonly width: number;
  readonly height: number;
  readonly pieceTypes: readonly PieceType[];
  readonly piecesToPlace: number;
  readonly benchSize: number;
  readonly minPerType: number;
  readonly maxPerType: number;
  readonly maxPerRow: number;
  readonly pointsToWin: number;
  /** Filas de despliegue del jugador (índices de tablero, ascendentes). */
  placementRows(p: Player): readonly number[];
  /** Fila base del jugador: 0 para BLANCAS, height−1 para NEGRAS. */
  homeRow(p: Player): number;
  /** Fila donde el jugador anota: la fila base del rival. */
  scoringRow(p: Player): number;
  /** Dirección de avance: +1 BLANCAS (hacia y creciente), −1 NEGRAS. */
  forward(p: Player): 1 | -1;
}

/** Subconjunto de GAME_RULES que RulesView necesita (sirve para variantes de test). */
export interface RulesSource {
  PIECES_TO_PLACE: number;
  PIECES_IN_BENCH: number;
  MIN_PIECES_PER_TYPE: number;
  MAX_PIECES_PER_TYPE: number;
  MAX_PIECES_PER_ROW: number;
  POINTS_TO_WIN: number;
  PLACEMENT_DEPTH: number;
}

/**
 * Construye la vista de reglas para un tamaño de tablero y cantidades dadas.
 * Recalcula las filas con la misma fórmula que GAME_RULES (no lee
 * PLACEMENT_ROWS_*), así sirve para variantes con otro alto/profundidad.
 */
export function buildRulesView(
  board: { BOARD_WIDTH: number; BOARD_HEIGHT: number },
  rules: RulesSource,
  pieceTypes: readonly PieceType[] = Object.values(PieceType),
): RulesView {
  const homeRow = (p: Player): number => (p === Player.BLANCAS ? 0 : board.BOARD_HEIGHT - 1);
  const forward = (p: Player): 1 | -1 => (p === Player.BLANCAS ? 1 : -1);
  const scoringRow = (p: Player): number =>
    homeRow(p === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS);
  const rowsCache = new Map<Player, readonly number[]>();
  const placementRows = (p: Player): readonly number[] => {
    const cached = rowsCache.get(p);
    if (cached) return cached;
    const rows = Object.freeze(
      Array.from(
        { length: rules.PLACEMENT_DEPTH },
        (_, i) => homeRow(p) + forward(p) * (i + 1),
      ).sort((a, b) => a - b),
    );
    rowsCache.set(p, rows);
    return rows;
  };

  return Object.freeze({
    width: board.BOARD_WIDTH,
    height: board.BOARD_HEIGHT,
    pieceTypes: Object.freeze([...pieceTypes]),
    piecesToPlace: rules.PIECES_TO_PLACE,
    benchSize: rules.PIECES_IN_BENCH,
    minPerType: rules.MIN_PIECES_PER_TYPE,
    maxPerType: rules.MAX_PIECES_PER_TYPE,
    maxPerRow: rules.MAX_PIECES_PER_ROW,
    pointsToWin: rules.POINTS_TO_WIN,
    placementRows,
    homeRow,
    scoringRow,
    forward,
  });
}

/** Reglas vigentes del juego real (derivadas de GAME_CONFIG + GAME_RULES). */
export const CURRENT_RULES: RulesView = buildRulesView(GAME_CONFIG, GAME_RULES);

/**
 * Serializa una RulesView a los parámetros de `buildRulesView` (para enviarla
 * por `postMessage` a un worker). `PLACEMENT_DEPTH` se deduce de las filas.
 */
export function toRulesSource(view: RulesView): {
  board: { BOARD_WIDTH: number; BOARD_HEIGHT: number };
  rules: RulesSource;
  pieceTypes: readonly PieceType[];
} {
  return {
    board: { BOARD_WIDTH: view.width, BOARD_HEIGHT: view.height },
    rules: {
      PIECES_TO_PLACE: view.piecesToPlace,
      PIECES_IN_BENCH: view.benchSize,
      MIN_PIECES_PER_TYPE: view.minPerType,
      MAX_PIECES_PER_TYPE: view.maxPerType,
      MAX_PIECES_PER_ROW: view.maxPerRow,
      POINTS_TO_WIN: view.pointsToWin,
      PLACEMENT_DEPTH: view.placementRows(Player.BLANCAS).length,
    },
    pieceTypes: view.pieceTypes,
  };
}

/** Huella estable de una combinación reglas + config de piezas (para memoizar). */
export function rulesFingerprint(rules: RulesView, pieceConfig: unknown): string {
  return JSON.stringify({
    width: rules.width,
    height: rules.height,
    pieceTypes: rules.pieceTypes,
    piecesToPlace: rules.piecesToPlace,
    benchSize: rules.benchSize,
    minPerType: rules.minPerType,
    maxPerType: rules.maxPerType,
    maxPerRow: rules.maxPerRow,
    pointsToWin: rules.pointsToWin,
    placementRows: {
      [Player.BLANCAS]: rules.placementRows(Player.BLANCAS),
      [Player.NEGRAS]: rules.placementRows(Player.NEGRAS),
    },
    homeRow: {
      [Player.BLANCAS]: rules.homeRow(Player.BLANCAS),
      [Player.NEGRAS]: rules.homeRow(Player.NEGRAS),
    },
    scoringRow: {
      [Player.BLANCAS]: rules.scoringRow(Player.BLANCAS),
      [Player.NEGRAS]: rules.scoringRow(Player.NEGRAS),
    },
    pieceConfig,
  });
}

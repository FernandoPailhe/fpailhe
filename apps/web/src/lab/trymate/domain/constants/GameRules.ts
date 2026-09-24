import { GAME_CONFIG } from "./GameConstants";

const BOARD_HEIGHT = GAME_CONFIG.BOARD_HEIGHT;
const PLACEMENT_DEPTH = 3;
const PIECES_TO_PLACE = 5;
const PIECES_IN_BENCH = 3;

/** Filas de despliegue: las PLACEMENT_DEPTH filas siguientes a la fila base, ascendentes. */
const placementRowsFrom = (home: number, dir: 1 | -1): readonly number[] =>
  Array.from({ length: PLACEMENT_DEPTH }, (_, i) => home + dir * (i + 1)).sort((a, b) => a - b);

export const GAME_RULES = {
  PIECES_TO_PLACE,
  PIECES_IN_BENCH,
  TOTAL_PIECES_PER_PLAYER: PIECES_TO_PLACE + PIECES_IN_BENCH,

  MIN_PIECES_PER_TYPE: 2,
  MAX_PIECES_PER_TYPE: 4,

  PLACEMENT_DEPTH,
  PLACEMENT_ROWS_PLAYER1: placementRowsFrom(0, 1), // [1,2,3]
  PLACEMENT_ROWS_PLAYER2: placementRowsFrom(BOARD_HEIGHT - 1, -1), // [7,8,9]

  MAX_PIECES_PER_ROW: 2,

  SCORING_ZONE_PLAYER1: BOARD_HEIGHT - 1,
  SCORING_ZONE_PLAYER2: 0,

  POINTS_TO_WIN: 3,

  FORBIDDEN_ZONE_PLAYER1: 0,
  FORBIDDEN_ZONE_PLAYER2: BOARD_HEIGHT - 1,
} as const;

export enum GamePhase {
  SETUP = "SETUP",
  BENCH_SELECTION = "BENCH_SELECTION",
  PLAYING = "PLAYING",
  GAME_OVER = "GAME_OVER",
}

export enum GameMode {
  PVP = "PVP",
  ONLINE = "ONLINE",
  VS_COMPUTER = "VS_COMPUTER",
}

/** Modo de turnos durante el setup. No confundir con `RoomSetupMode`
 *  ("manual" | "quick"), que indica si se usan posiciones
 *  predeterminadas o personalizadas. */
export enum SetupTurnMode {
  ALTERNATING = "ALTERNATING",
  HIDDEN = "HIDDEN",
}

/** Modo de configuración inicial de una sala online. */
export type RoomSetupMode = "manual" | "quick";

export interface PieceCount {
  FORT: number;
  STRIKER: number;
  PIONEER: number;
}

export const INITIAL_PIECE_COUNT: PieceCount = {
  FORT: 0,
  STRIKER: 0,
  PIONEER: 0,
};

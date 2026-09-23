export const GAME_RULES = {
  TOTAL_PIECES_PER_PLAYER: 8,
  PIECES_TO_PLACE: 5,
  PIECES_IN_BENCH: 3,

  MIN_PIECES_PER_TYPE: 2,
  MAX_PIECES_PER_TYPE: 4,

  PLACEMENT_ROWS_PLAYER1: [1, 2, 3],
  PLACEMENT_ROWS_PLAYER2: [7, 8, 9],

  MAX_PIECES_PER_ROW: 2,

  SCORING_ZONE_PLAYER1: 10,
  SCORING_ZONE_PLAYER2: 0,

  POINTS_TO_WIN: 3,

  FORBIDDEN_ZONE_PLAYER1: 0,
  FORBIDDEN_ZONE_PLAYER2: 10,
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

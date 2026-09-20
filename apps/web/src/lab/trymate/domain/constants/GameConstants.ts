export const GAME_CONFIG = {
  BOARD_WIDTH: 5,
  BOARD_HEIGHT: 11,
  TILE_SIZE: 1,
} as const;

export type GameConfig = typeof GAME_CONFIG;

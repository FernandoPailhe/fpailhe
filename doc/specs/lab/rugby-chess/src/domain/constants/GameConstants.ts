export const GAME_CONFIG = {
  BOARD_WIDTH: 5,
  BOARD_HEIGHT: 11,
  TILE_SIZE: 1,
  TILE_SPACING: 0.1,
  CAMERA: {
    POSITION: { x: 3, y: 15, z: 15 },
    FOV: 60,
    NEAR: 0.1,
    FAR: 1000,
  },
  LIGHTING: {
    AMBIENT_COLOR: 0x404040,
    AMBIENT_INTENSITY: 0.6,
    DIRECTIONAL_COLOR: 0xffffff,
    DIRECTIONAL_INTENSITY: 0.8,
    DIRECTIONAL_POSITION: { x: 5, y: 10, z: 5 },
  },
  COLORS: {
    TILE_DEFAULT: 0x8b7355,
    TILE_ALTERNATE: 0xa0826d,
    TILE_SELECTED: 0x4a90e2,
    TILE_HOVER: 0x6ab7ff,
    BOARD_BORDER: 0x3d2817,
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;

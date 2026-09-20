export enum PieceType {
  BULWARK = "BULWARK",
  VANGUARD = "VANGUARD",
  APEX = "APEX",
}

export enum Player {
  BLANCAS = "BLANCAS",
  NEGRAS = "NEGRAS",
}

export interface DirectionVector {
  dx: number;
  dy: number;
}

export interface MovementPattern {
  directions: DirectionVector[];
  minDistance: number;
  maxDistance: number;
  canCapture: boolean;
}

export interface CapturePattern {
  directions: DirectionVector[];
  minDistance: number;
  maxDistance: number;
}

export const PIECE_MOVEMENT_CONFIG = {
  [PieceType.BULWARK]: {
    movement: {
      directions: [{ dx: 0, dy: 1 }],
      minDistance: 1,
      maxDistance: 1,
      canCapture: false,
    } as MovementPattern,
    capture: {
      directions: [
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 1,
    } as CapturePattern,
    blocksSides: true,
    blockedSideOffsets: [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ] as DirectionVector[],
  },
  [PieceType.VANGUARD]: {
    movement: {
      directions: [
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 1,
      canCapture: false,
    } as MovementPattern,
    alternativeMovement: {
      directions: [{ dx: 0, dy: 1 }],
      minDistance: 2,
      maxDistance: 2,
      canCapture: false,
    } as MovementPattern,
    capture: {
      directions: [{ dx: 0, dy: 1 }],
      minDistance: 1,
      maxDistance: 1,
    } as CapturePattern,
    blocksSides: false,
  },
  [PieceType.APEX]: {
    movement: {
      directions: [
        // Only forward movement defined here - L-shape moves are calculated separately
        { dx: 0, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 3, // Can move 1-3 squares forward
      canCapture: false,
    } as MovementPattern,
    blocksSides: false,
    canBypassBlocker: true,
    bypassMinDistance: 2,
    maxTotalDistance: 3, // Maximum total movement (forward + lateral)
  },
} as const;

export const PIECE_COLORS = {
  [Player.BLANCAS]: 0xffffff, // White pieces
  [Player.NEGRAS]: 0x333333, // Black pieces
};

export const PIECE_VISUAL_CONFIG = {
  [PieceType.BULWARK]: {
    geometry: "box",
    scale: { x: 1.0, y: 0.8, z: 0.3 },
    heightOffset: 0.5,
  },
  [PieceType.VANGUARD]: {
    geometry: "cone",
    scale: { x: 0.5, y: 1.0, z: 0.5 },
    heightOffset: 0.6,
  },
  [PieceType.APEX]: {
    geometry: "cylinder",
    scale: { x: 0.5, y: 0.25, z: 0.5 },
    heightOffset: 0.5,
  },
} as const;

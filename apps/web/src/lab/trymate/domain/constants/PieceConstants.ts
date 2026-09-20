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

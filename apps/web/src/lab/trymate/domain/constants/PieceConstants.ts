export enum PieceType {
  FORT = "FORT",
  STRIKER = "STRIKER",
  PIONEER = "PIONEER",
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

/**
 * Config de movimiento de un tipo de pieza. Los flags de mecánica viven acá
 * (no en el motor): cambiar un movimiento es editar este objeto.
 */
export interface PieceMovementConfig {
  movement: MovementPattern;
  /** Patrón secundario; `requiresClearPath` exige camino libre (carga). */
  alternativeMovement?: MovementPattern & { requiresClearPath?: boolean };
  capture?: CapturePattern;
  /** Bloquea las casillas de `blockedSideOffsets` a las piezas rivales. */
  blocksSides?: boolean;
  blockedSideOffsets?: DirectionVector[];
  /** Avanza 1..maxDistance y luego hasta `maxLateral` al costado (en L). */
  lShape?: boolean;
  /** Máximo desplazamiento lateral de un movimiento en L (default 1). */
  maxLateral?: number;
  /** Tope total (adelante + lateral) de un movimiento en L. */
  maxTotalDistance?: number;
  /** Puede pasar un bloqueo lateral si el bloqueante está lejos. */
  canBypassBlocker?: boolean;
  /** Distancia mínima al bloqueante para poder pasarlo (default 2). */
  bypassMinDistance?: number;
  /** Puede entrar a una casilla bloqueada si hay un rival para capturar. */
  captureIgnoresSideBlock?: boolean;
}

export type PieceMovementConfigMap = Record<PieceType, PieceMovementConfig>;

export const PIECE_MOVEMENT_CONFIG: PieceMovementConfigMap = {
  [PieceType.FORT]: {
    movement: {
      directions: [{ dx: 0, dy: 1 }],
      minDistance: 1,
      maxDistance: 1,
      canCapture: false,
    },
    capture: {
      directions: [
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 1,
    },
    blocksSides: true,
    blockedSideOffsets: [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ],
    captureIgnoresSideBlock: true,
  },
  [PieceType.STRIKER]: {
    movement: {
      directions: [
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 1,
      canCapture: false,
    },
    alternativeMovement: {
      directions: [{ dx: 0, dy: 1 }],
      minDistance: 2,
      maxDistance: 2,
      canCapture: false,
      requiresClearPath: true,
    },
    capture: {
      directions: [{ dx: 0, dy: 1 }],
      minDistance: 1,
      maxDistance: 1,
    },
    blocksSides: false,
  },
  [PieceType.PIONEER]: {
    movement: {
      directions: [
        // Only forward movement defined here - L-shape moves are calculated separately
        { dx: 0, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 3, // Can move 1-3 squares forward
      canCapture: false,
    },
    blocksSides: false,
    lShape: true,
    maxLateral: 1,
    maxTotalDistance: 3, // Maximum total movement (forward + lateral)
    canBypassBlocker: true,
    bypassMinDistance: 2,
  },
};

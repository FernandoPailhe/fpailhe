import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GamePhase, GAME_RULES } from "../domain/constants/GameRules";
import type { Position } from "../domain/entities/Position";

export const PIECE_ASSET: Record<PieceType, string> = {
  [PieceType.FORT]: "/lab/trymate/pieces/fort.svg",
  [PieceType.STRIKER]: "/lab/trymate/pieces/striker.svg",
  [PieceType.PIONEER]: "/lab/trymate/pieces/pioneer.svg",
};

export const PIECE_LABEL: Record<PieceType, string> = {
  [PieceType.FORT]: "Fort",
  [PieceType.STRIKER]: "Striker",
  [PieceType.PIONEER]: "Pioneer",
};

export const PLAYER_LABEL: Record<Player, string> = {
  [Player.BLANCAS]: "White",
  [Player.NEGRAS]: "Black",
};

export const PHASE_LABEL: Record<GamePhase, string> = {
  [GamePhase.SETUP]: "Setup",
  [GamePhase.BENCH_SELECTION]: "Bench selection",
  [GamePhase.PLAYING]: "Playing",
  [GamePhase.GAME_OVER]: "Game over",
};

/** Letra de columna (a–e) tal como se etiqueta en el borde inferior. */
export function fileLabel(x: number): string {
  return "abcde"[x] ?? "?";
}

/** Número de fila (1–11) tal como se etiqueta en el borde derecho. */
export function rankLabel(y: number): string {
  return String(y + 1);
}

/** Nombre tipo ajedrez: columna a–e + fila 1–11 ("c4"). Para aria-labels. */
export function squareName(pos: Position): string {
  return `${fileLabel(pos.x)}${rankLabel(pos.y)}`;
}

/**
 * Si la fila es una zona de anotación (filas 1 y 11) devuelve el borde
 * externo del tablero hacia el que se "apaga" la casilla; si no, null.
 */
export function scoringZoneEdge(y: number): "top" | "bottom" | null {
  if (y === GAME_RULES.SCORING_ZONE_PLAYER1) return "top";
  if (y === GAME_RULES.SCORING_ZONE_PLAYER2) return "bottom";
  return null;
}

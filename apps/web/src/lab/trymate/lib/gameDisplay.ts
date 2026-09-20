import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GamePhase } from "../domain/constants/GameRules";
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

/** Nombre tipo ajedrez: columna a–e + fila 1–11 ("c4"). Para aria-labels. */
export function squareName(pos: Position): string {
  return `${"abcde"[pos.x] ?? "?"}${pos.y + 1}`;
}

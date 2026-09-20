import { PieceType, Player } from "../domain/constants/PieceConstants";
import { GamePhase } from "../domain/constants/GameRules";
import type { Position } from "../domain/entities/Position";

export const PIECE_ASSET: Record<PieceType, string> = {
  [PieceType.BULWARK]: "/lab/trymate/pieces/muralla.svg",
  [PieceType.VANGUARD]: "/lab/trymate/pieces/ariete.svg",
  [PieceType.APEX]: "/lab/trymate/pieces/explorador.svg",
};

export const PIECE_LABEL: Record<PieceType, string> = {
  [PieceType.BULWARK]: "Bulwark",
  [PieceType.VANGUARD]: "Vanguard",
  [PieceType.APEX]: "Apex",
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

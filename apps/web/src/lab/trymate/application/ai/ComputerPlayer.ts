import type { Board } from "../../domain/entities/Board";
import type { Position } from "../../domain/entities/Position";
import type { PlayerState } from "../../domain/entities/PlayerState";
import type { PieceType, Player } from "../../domain/constants/PieceConstants";
import type { SetupTurnMode } from "../../domain/constants/GameRules";
import type { RulesView } from "../../domain/config/RulesView";
import type { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { createEasyBot } from "./EasyBot";
import type { Rng } from "./rng";

export type BotDifficulty = "easy";

/** Acción de juego elegida por un bot en PLAYING. */
export type BotPlayAction =
  | { kind: "bench"; benchPieceId: string; to: Position }
  | { kind: "move"; pieceId: string; to: Position }
  | { kind: "pass" };

/**
 * Todo lo que un bot puede consultar para decidir. En SETUP HIDDEN el board
 * solo muestra las piezas propias. El bot no conoce reglas por su cuenta:
 * las recibe acá (`rules`, `engine`) — nunca importa las constantes del juego.
 */
export interface BotContext {
  board: Board;
  bot: Player;
  botState: PlayerState;
  opponentState: PlayerState;
  engine: MovementRuleEngine;
  rules: RulesView;
  setupMode: SetupTurnMode;
  rng: Rng;
}

/**
 * Jugador controlado por computadora. Su estado interno (plan de despliegue,
 * memoizaciones) vive en la instancia, no en el store.
 */
export interface ComputerPlayer {
  readonly difficulty: BotDifficulty;
  /** Próxima pieza a colocar en SETUP; null si no hay colocación válida. */
  chooseSetupPlacement(ctx: BotContext): { type: PieceType; position: Position } | null;
  /** Próximo tipo de banca; null si no hay elección válida. */
  chooseBenchType(ctx: BotContext): PieceType | null;
  /** Acción de PLAYING: banca, movimiento o pase. */
  choosePlayAction(ctx: BotContext): BotPlayAction;
}

const FACTORIES: Partial<Record<BotDifficulty, (rng: Rng) => ComputerPlayer>> = {
  easy: createEasyBot,
};

export function registerComputerPlayer(
  difficulty: BotDifficulty,
  factory: (rng: Rng) => ComputerPlayer,
): void {
  FACTORIES[difficulty] = factory;
}

export function createComputerPlayer(difficulty: BotDifficulty, rng: Rng): ComputerPlayer {
  const factory = FACTORIES[difficulty];
  if (!factory) {
    throw new Error(`ComputerPlayer: dificultad no registrada "${difficulty}"`);
  }
  return factory(rng);
}

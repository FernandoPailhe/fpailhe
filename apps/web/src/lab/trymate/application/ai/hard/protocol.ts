import type { PieceType } from "../../../domain/constants/PieceConstants";
import { Player } from "../../../domain/constants/PieceConstants";
import type { PieceMovementConfigMap } from "../../../domain/constants/PieceConstants";
import type { SetupTurnMode } from "../../../domain/constants/GameRules";
import { toRulesSource, type RulesSource } from "../../../domain/config/RulesView";
import type { BotContext } from "../ComputerPlayer";
import type { Personality } from "../personality";
import type { HardSearchResult, SearchBudget } from "./search";

/** Pieza serializada (position nunca es null: en banca no viaja por acá). */
export interface SerializedPiece {
  id: string;
  type: PieceType;
  owner: Player;
  x: number;
  y: number;
}

/** Plan de ejército serializado (positions como {x,y} planos). */
export interface SerializedArmyPlan {
  boardPieces: { type: PieceType; x: number; y: number }[];
  benchPieces: PieceType[];
}

/**
 * Request al worker de Hard. `kind: "play"` busca la jugada; `kind: "setup"`
 * planifica el ejército (devuelve `SerializedArmyPlan`).
 */
export interface HardRequest {
  id: number;
  kind: "play" | "setup";
  bot: Player;
  current: Player;
  board: { width: number; height: number; pieces: SerializedPiece[] };
  scores: Record<Player, number>;
  bench: Record<Player, PieceType[]>;
  /** Tipos ya elegidos por cada bando (para recomponer PlayerState en setup). */
  selectedTypes: Record<Player, PieceType[]>;
  rulesSource: RulesSource;
  boardDims: { BOARD_WIDTH: number; BOARD_HEIGHT: number };
  pieceTypes: readonly PieceType[];
  pieceConfig: PieceMovementConfigMap;
  setupMode: SetupTurnMode;
  seed: number;
  budget: SearchBudget;
  /** Presupuesto del muestreo de ejércitos (solo kind "setup"). */
  setupBudget?: { candidates: number; nodesPerEval: number };
  personality: Personality;
}

export type HardResponse =
  | { id: number; ok: true; result: HardSearchResult | SerializedArmyPlan }
  | { id: number; ok: false; error: string };

/**
 * Serializa el `BotContext` para `postMessage` (todo JSON-plano, clonable).
 * `seed` fija el rng del worker → determinismo igual que en el hilo.
 */
export function toHardRequest(
  ctx: BotContext,
  budget: SearchBudget,
  seed: number,
  id: number,
  personality: Personality,
  kind: "play" | "setup" = "play",
  setupBudget?: { candidates: number; nodesPerEval: number },
): HardRequest {
  const pieces: SerializedPiece[] = [];
  for (const p of ctx.board.getAllPieces()) {
    if (!p.position) continue;
    pieces.push({ id: p.id, type: p.type, owner: p.owner, x: p.position.x, y: p.position.y });
  }
  const { board, rules, pieceTypes } = toRulesSource(ctx.rules);
  const other = ctx.bot === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
  const benchOf = (player: Player): PieceType[] =>
    (player === ctx.bot ? ctx.botState : ctx.opponentState).getBenchPieces().map((p) => p.type);
  return {
    id,
    kind,
    bot: ctx.bot,
    current: ctx.bot, // el bot decide en su turno
    board: { width: ctx.board.width, height: ctx.board.height, pieces },
    scores: {
      [ctx.bot]: ctx.botState.getScore(),
      [other]: ctx.opponentState.getScore(),
    } as Record<Player, number>,
    bench: {
      [Player.BLANCAS]: benchOf(Player.BLANCAS),
      [Player.NEGRAS]: benchOf(Player.NEGRAS),
    },
    selectedTypes: {
      [Player.BLANCAS]:
        ctx.bot === Player.BLANCAS
          ? ctx.botState.getSelectedPieces()
          : ctx.opponentState.getSelectedPieces(),
      [Player.NEGRAS]:
        ctx.bot === Player.NEGRAS
          ? ctx.botState.getSelectedPieces()
          : ctx.opponentState.getSelectedPieces(),
    },
    rulesSource: rules,
    boardDims: board,
    pieceTypes,
    pieceConfig: ctx.engine.config,
    setupMode: ctx.setupMode,
    seed,
    budget,
    setupBudget,
    personality,
  };
}

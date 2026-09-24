import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { PIECE_MOVEMENT_CONFIG, PieceType, Player } from "../../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../../domain/constants/GameRules";
import { CURRENT_RULES, rulesFingerprint } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { analyzeBoard } from "../analysis/boardAnalysis";
import { getRulesInsight } from "../introspection/profiles";
import type { BotContext, BotPlayAction } from "../ComputerPlayer";
import { createMediumBot, type MediumBot } from "../MediumBot";
import { createSeededRng } from "../rng";

/**
 * Escenarios anclados a las reglas actuales: si cambia el tablero, las filas,
 * las cantidades o los patrones de movimiento, estos tests se saltean con un
 * aviso para re-anclarlos (son comportamiento, no legalidad — la legalidad la
 * cubren las variantes de arena).
 */
const EXPECTED_FINGERPRINT =
  '{"width":5,"height":11,"pieceTypes":["FORT","STRIKER","PIONEER"],"piecesToPlace":5,"benchSize":3,"minPerType":2,"maxPerType":4,"maxPerRow":2,"pointsToWin":3,"placementRows":{"BLANCAS":[1,2,3],"NEGRAS":[7,8,9]},"homeRow":{"BLANCAS":0,"NEGRAS":10},"scoringRow":{"BLANCAS":10,"NEGRAS":0},"pieceConfig":{"FORT":{"movement":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":1,"canCapture":false},"capture":{"directions":[{"dx":1,"dy":1},{"dx":-1,"dy":1}],"minDistance":1,"maxDistance":1},"blocksSides":true,"blockedSideOffsets":[{"dx":-1,"dy":0},{"dx":1,"dy":0}],"captureIgnoresSideBlock":true},"STRIKER":{"movement":{"directions":[{"dx":0,"dy":1},{"dx":1,"dy":1},{"dx":-1,"dy":1}],"minDistance":1,"maxDistance":1,"canCapture":false},"alternativeMovement":{"directions":[{"dx":0,"dy":1}],"minDistance":2,"maxDistance":2,"canCapture":false,"requiresClearPath":true},"capture":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":1},"blocksSides":false},"PIONEER":{"movement":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":3,"canCapture":false},"blocksSides":false,"lShape":true,"maxLateral":1,"maxTotalDistance":3,"canBypassBlocker":true,"bypassMinDistance":2}}}';

const rulesChanged =
  rulesFingerprint(CURRENT_RULES, PIECE_MOVEMENT_CONFIG) !== EXPECTED_FINGERPRINT;
if (rulesChanged) {
  console.warn("[tactics] Las reglas cambiaron: revisar y re-anclar estos escenarios.");
}

const engine = new MovementRuleEngine();
const insight = getRulesInsight(CURRENT_RULES, engine, engine.config);
const pos = (x: number, y: number) => new Position(x, y);
const BOT = Player.NEGRAS;
const HUMAN = Player.BLANCAS;

const makeCtx = (board: Board, botState: PlayerState): BotContext => ({
  board,
  bot: BOT,
  botState,
  opponentState: new PlayerState("opp"),
  engine,
  rules: CURRENT_RULES,
  setupMode: SetupTurnMode.ALTERNATING,
  // rng 0.4: evita la blunderChance y elige el mejor del pool de tolerancia.
  rng: () => 0.4,
});

const play = (
  board: Board,
  botState = new PlayerState("bot"),
): {
  action: BotPlayAction;
  bot: MediumBot;
} => {
  const bot = createMediumBot(createSeededRng(7));
  return { action: bot.choosePlayAction(makeCtx(board, botState)), bot };
};

const boardOf = (...pieces: GamePiece[]): Board => {
  const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
  pieces.forEach((p) => board.addPiece(p));
  return board;
};

describe.skipIf(rulesChanged)("Medium tactics (reglas actuales)", () => {
  it("frena corredor: captura al striker rival a 2 de anotar, postura DEFEND", () => {
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(1, 9), BOT), // captura (2,8)
      new GamePiece("s", PieceType.STRIKER, pos(2, 8), HUMAN),
    );
    const { action, bot } = play(board);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      expect(action.pieceId).toBe("f");
      expect(action.to.equals(pos(2, 8))).toBe(true);
    }
    expect(bot.lastDecision!.posture).toBe("DEFEND");
  });

  it("tapona: reduce los avances legales del striker rival", () => {
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(1, 9), BOT),
      new GamePiece("f2", PieceType.FORT, pos(4, 9), BOT),
      new GamePiece("s", PieceType.STRIKER, pos(2, 7), HUMAN),
    );
    const striker = board.getPieceById("s")!;
    const advancesBefore = analyzeBoard(board, engine, insight).advanceMoves(striker).length;

    const { action } = play(board);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      board.movePiece(action.pieceId, action.to);
      const advancesAfter = analyzeBoard(board, engine, insight).advanceMoves(striker).length;
      expect(advancesAfter).toBeLessThan(advancesBefore);
    }
  });

  it("no cuelga: no avanza a una casilla atacada sin defensa", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT),
      new GamePiece("w1", PieceType.FORT, pos(0, 3), HUMAN), // ataca (1,4)
      new GamePiece("w2", PieceType.FORT, pos(4, 3), HUMAN), // ataca (3,4)
    );
    const { action } = play(board);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      expect(action.to.equals(pos(1, 4))).toBe(false);
      expect(action.to.equals(pos(3, 4))).toBe(false);
    }
  });

  it("captura una pieza indefensa", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT),
      new GamePiece("w", PieceType.FORT, pos(2, 4), HUMAN),
    );
    const { action } = play(board);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      expect(action.to.equals(pos(2, 4))).toBe(true);
    }
  });

  it("avanza en bloque: la retaguardia cierra la brecha en vez de estirar al líder", () => {
    const board = boardOf(
      new GamePiece("l", PieceType.FORT, pos(0, 6), BOT), // líder (prog 4), sin carril libre
      new GamePiece("s", PieceType.STRIKER, pos(2, 9), BOT), // retaguardia (prog 1)
      new GamePiece("w", PieceType.FORT, pos(0, 2), HUMAN), // cierra el carril del líder
    );
    const { action } = play(board);
    expect(action.kind).toBe("move");
    // Avanza el STRIKER de atrás (cierra la brecha), no el FORT líder.
    if (action.kind === "move") expect(action.pieceId).toBe("s");
  });

  it("anota para ganar con 2 puntos y pieza a 1 de la meta", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(0, 1), BOT),
      new GamePiece("w", PieceType.FORT, pos(4, 8), HUMAN),
    );
    const ps = new PlayerState("bot");
    ps.incrementScore();
    ps.incrementScore();
    const { action } = play(board, ps);
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      expect(action.pieceId).toBe("s");
      expect(action.to.equals(pos(0, 0))).toBe(true);
    }
  });
});

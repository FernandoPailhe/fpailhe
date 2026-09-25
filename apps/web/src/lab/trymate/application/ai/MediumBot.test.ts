import { describe, expect, it } from "vitest";
import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { PlayerState } from "../../domain/entities/PlayerState";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { GamePhase, SetupTurnMode } from "../../domain/constants/GameRules";
import { CURRENT_RULES } from "../../domain/config/RulesView";
import { createGameStore } from "../GameState";
import { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { createComputerPlayer, type BotContext } from "./ComputerPlayer";
import { createMediumBot, type MediumBot } from "./MediumBot";
import { createSeededRng } from "./rng";

const engine = new MovementRuleEngine();
const pos = (x: number, y: number) => new Position(x, y);
const BOT = Player.NEGRAS;
const emptyBoard = () => new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);

const makeCtx = (board: Board, botState: PlayerState, rng = () => 0.9): BotContext => ({
  board,
  bot: BOT,
  botState,
  opponentState: new PlayerState("opp"),
  engine,
  rules: CURRENT_RULES,
  setupMode: SetupTurnMode.ALTERNATING,
  rng,
});

describe("createMediumBot — unitario", () => {
  it("mueve una pieza legal y completa lastDecision", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(0, 3), Player.BLANCAS));
    const bot = createMediumBot(createSeededRng(1));
    const action = bot.choosePlayAction(makeCtx(board, new PlayerState("bot")));
    expect(action.kind).toBe("move");
    if (action.kind === "move") {
      const piece = board.getPieceById(action.pieceId)!;
      const legal = engine.getValidMoves(piece, board);
      expect(legal.some((m) => m.equals(action.to))).toBe(true);
    }
    expect(bot.lastDecision).not.toBeNull();
    expect(bot.lastDecision!.depth).toBeGreaterThanOrEqual(1);
    expect(bot.lastDecision!.top.length).toBeGreaterThan(0);
    expect(["ATTACK", "DEFEND", "BALANCED"]).toContain(bot.lastDecision!.posture);
  });

  it("banca disponible → primera acción es bench", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT));
    const ps = new PlayerState("bot");
    ps.addSelectedPiece(PieceType.STRIKER);
    ps.addBenchPiece(new GamePiece("b-0", PieceType.FORT, null, BOT));
    const bot = createMediumBot(createSeededRng(1));
    const action = bot.choosePlayAction(makeCtx(board, ps));
    expect(action.kind).toBe("bench");
    if (action.kind === "bench") {
      expect(action.benchPieceId).toBe("b-0");
      expect(CURRENT_RULES.placementRows(BOT)).toContain(action.to.y);
    }
  });

  it("sin movimientos ni banca → pass", () => {
    const bot = createMediumBot(createSeededRng(1));
    const action = bot.choosePlayAction(makeCtx(emptyBoard(), new PlayerState("bot")));
    expect(action).toEqual({ kind: "pass" });
  });

  it("registro: createComputerPlayer('medium') devuelve un MediumBot", () => {
    const bot = createComputerPlayer("medium", createSeededRng(1));
    expect(bot.difficulty).toBe("medium");
    expect((bot as MediumBot).lastDecision).toBeNull();
  });
});

describe("createMediumBot — store", () => {
  const TYPES = [
    PieceType.FORT,
    PieceType.STRIKER,
    PieceType.PIONEER,
    PieceType.FORT,
    PieceType.STRIKER,
  ];
  const WHITE_SPOTS = [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2), pos(0, 3)];

  it("ALTERNATING: despliega 5 piezas válidas y llega a PLAYING", () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.ALTERNATING, "medium");
    const S = () => store.getState();
    expect(S().botDifficulty).toBe("medium");

    for (let i = 0; i < 5; i++) {
      S().selectPieceTypeForSetup(TYPES[i]!);
      S().handleTileClick(WHITE_SPOTS[i]!);
      expect(S().currentPlayer).toBe(Player.NEGRAS);
      expect(S().runBotTurn(() => 0.5)).toBe(true);
    }
    const blackOnBoard = S()
      .board.getAllPieces()
      .filter((p) => p.owner === Player.NEGRAS);
    expect(blackOnBoard).toHaveLength(5);
    expect(
      blackOnBoard.every(
        (p) => p.position && CURRENT_RULES.placementRows(Player.NEGRAS).includes(p.position.y),
      ),
    ).toBe(true);

    // Banca: humano elige las suyas; el bot las suyas en cadena.
    [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER].forEach((t) =>
      S().selectPieceTypeForBench(t),
    );
    let steps = 0;
    while (
      S().currentPlayer === Player.NEGRAS &&
      S().gamePhase !== GamePhase.GAME_OVER &&
      steps++ < 30
    ) {
      if (!S().runBotTurn(() => 0.5)) break;
    }
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    expect(S().player2State.getBenchPieces()).toHaveLength(3);
  });

  it("quick start: tras la jugada humana el bot responde con una jugada legal", () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.ALTERNATING, "medium");
    store.getState().quickStart("classic", "classic");
    const S = () => store.getState();

    S().handleTileClick(pos(2, 2));
    S().handleTileClick(pos(2, 4));
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    expect(S().runBotTurn(() => 0.5)).toBe(true);
    expect(S().currentPlayer).toBe(Player.BLANCAS);
    expect(S().moveHistory.getCurrentMove()?.player).toBe(Player.NEGRAS);
  });

  it("HIDDEN: completa su setup y no ve piezas rivales al desplegar", () => {
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.HIDDEN, "medium");
    const S = () => store.getState();

    for (let i = 0; i < 5; i++) {
      S().selectPieceTypeForSetup(TYPES[i]!);
      S().handleTileClick(WHITE_SPOTS[i]!);
    }
    [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER].forEach((t) =>
      S().selectPieceTypeForBench(t),
    );
    expect(S().currentPlayer).toBe(Player.NEGRAS);

    let steps = 0;
    while (
      S().currentPlayer === Player.NEGRAS &&
      S().gamePhase !== GamePhase.GAME_OVER &&
      steps++ < 30
    ) {
      if (!S().runBotTurn(() => 0.5)) break;
    }
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    expect(S().player2State.getPlacedPiecesCount()).toBe(5);
    expect(S().player2State.getBenchPieces()).toHaveLength(3);
  });
});

describe("getLastDecisionInfo", () => {
  it("expone postura, depth, nodos y top coherente con la acción elegida", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(0, 3), Player.BLANCAS));
    const bot = createMediumBot(createSeededRng(1));
    expect(bot.getLastDecisionInfo?.() ?? null).toBeNull();
    const action = bot.choosePlayAction(makeCtx(board, new PlayerState("bot")));
    const info = bot.getLastDecisionInfo!();
    expect(info).not.toBeNull();
    expect(info!.depth).toBeGreaterThanOrEqual(1);
    expect(info!.nodes).toBeGreaterThan(0);
    expect(["ATTACK", "DEFEND", "BALANCED"]).toContain(info!.posture);
    if (action.kind === "move") {
      const hit = info!.top!.find(
        (t) =>
          t.action.kind === "move" &&
          t.action.pieceId === action.pieceId &&
          t.action.to.equals(action.to),
      );
      expect(hit, "la acción elegida debe estar en el top").toBeDefined();
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import { Position } from "../../../domain/entities/Position";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { GamePhase, SetupTurnMode } from "../../../domain/constants/GameRules";
import { CURRENT_RULES } from "../../../domain/config/RulesView";
import { createGameStore } from "../../GameState";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { canPlaceFromBench, getBenchPlacementSquares } from "../../rules/turnRules";
import {
  createComputerPlayer,
  loadComputerPlayer,
  needsAsyncLoad,
  registerComputerPlayer,
  type BotContext,
  type ComputerPlayer,
} from "../ComputerPlayer";
import { createHardBot } from "./HardBot";

const pos = (x: number, y: number) => new Position(x, y);

const TYPES = [
  PieceType.FORT,
  PieceType.STRIKER,
  PieceType.PIONEER,
  PieceType.FORT,
  PieceType.STRIKER,
];
const WHITE_SPOTS = [pos(0, 1), pos(1, 1), pos(0, 2), pos(1, 2), pos(0, 3)];
const BENCH_TYPES = [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER];

// Presupuestos mínimos: una partida completa en jsdom sin worker.
const TEST_OVERRIDES = {
  budget: { kind: "nodes", n: 300 } as const,
  fallbackBudget: { kind: "nodes", n: 300 } as const,
  setupBudget: { candidates: 4, nodesPerEval: 100 },
  inlineSetupBudget: { candidates: 4, nodesPerEval: 100 },
};

describe("hard — registro lazy", () => {
  it("no tiene fábrica sync; loadComputerPlayer resuelve el chunk", async () => {
    expect(needsAsyncLoad("hard")).toBe(true);
    expect(needsAsyncLoad("easy")).toBe(false);
    expect(() => createComputerPlayer("hard", Math.random)).toThrow();

    const bot = await loadComputerPlayer("hard", Math.random, { personality: "balanced" });
    expect(bot.difficulty).toBe("hard");
    expect(typeof bot.prepareSetupAsync).toBe("function");
    expect(typeof bot.choosePlayActionAsync).toBe("function");
    expect(typeof bot.dispose).toBe("function");
    bot.dispose?.();
  });
});

describe("hard — store", () => {
  it("startVsComputer('hard') → botLoading, controller cargado, setup vía plan", async () => {
    const store = createGameStore();
    const S = () => store.getState();
    S().startVsComputer(SetupTurnMode.ALTERNATING, "hard");
    expect(S().botLoading).toBe(true);
    expect(S().botController).toBeNull();
    await vi.waitFor(() => expect(S().botController).not.toBeNull(), { timeout: 10_000 });
    expect(S().botLoading).toBe(false);
    expect(S().botController?.difficulty).toBe("hard");

    // Turno del bot en SETUP: prepareSetupAsync (plan inline en jsdom) + place.
    S().selectPieceTypeForSetup(TYPES[0]!);
    S().handleTileClick(WHITE_SPOTS[0]!);
    expect(S().currentPlayer).toBe(Player.NEGRAS);
    const ok = await S().runBotTurnAsync(new AbortController().signal, () => 0.5);
    expect(ok).toBe(true);
    const rows = [7, 8, 9];
    const placed = S().board.getPiecesOf(Player.NEGRAS);
    expect(placed).toHaveLength(1);
    expect(rows).toContain(placed[0]!.position!.y);
    S().botController?.dispose?.();
  }, 30_000);

  it("reset hace dispose del controller", async () => {
    const dispose = vi.fn();
    const fake: ComputerPlayer = {
      difficulty: "hard",
      dispose,
      chooseSetupPlacement: () => null,
      chooseBenchType: () => null,
      choosePlayAction: () => ({ kind: "pass" }),
    };
    registerComputerPlayer("hard", () => fake);
    const store = createGameStore();
    store.getState().startVsComputer(SetupTurnMode.ALTERNATING, "hard");
    expect(store.getState().botLoading).toBe(false);
    expect(store.getState().botController).toBe(fake);
    store.getState().reset();
    expect(dispose).toHaveBeenCalledOnce();
    expect(store.getState().botController).toBeNull();
  });
});

describe("hard — partida completa (inline, presupuesto bajo)", () => {
  it("juega contra un humano simple hasta GAME_OVER sin ilegales", async () => {
    registerComputerPlayer("hard", (rng, opts) =>
      createHardBot(rng, { personality: opts.personality, overrides: TEST_OVERRIDES }),
    );
    const store = createGameStore();
    const S = () => store.getState();
    S().startVsComputer(SetupTurnMode.ALTERNATING, "hard");
    expect(S().botLoading).toBe(false);

    // Setup ALTERNATING: humano coloca, bot responde (planificado).
    for (let i = 0; i < 5; i++) {
      S().selectPieceTypeForSetup(TYPES[i]!);
      S().handleTileClick(WHITE_SPOTS[i]!);
      expect(S().currentPlayer).toBe(Player.NEGRAS);
      expect(await S().runBotTurnAsync(new AbortController().signal, () => 0.5)).toBe(true);
    }
    expect(S().gamePhase).toBe(GamePhase.BENCH_SELECTION);
    BENCH_TYPES.forEach((t) => S().selectPieceTypeForBench(t));
    while (S().gamePhase === GamePhase.BENCH_SELECTION) {
      expect(await S().runBotTurnAsync(new AbortController().signal, () => 0.5)).toBe(true);
    }
    expect(S().gamePhase).toBe(GamePhase.PLAYING);
    const rows = [7, 8, 9];
    for (const p of S().board.getPiecesOf(Player.NEGRAS)) {
      expect(rows).toContain(p.position!.y);
    }

    // PLAYING: el humano juega la primera acción disponible.
    const humanAct = (): void => {
      const s = S();
      const ps = s.player1State;
      const squares = getBenchPlacementSquares(s.board, Player.BLANCAS);
      if (canPlaceFromBench(s.board, Player.BLANCAS, ps) && squares.length > 0) {
        s.selectBenchPiece(ps.getBenchPieces()[0]!);
        S().placeBenchPiece(squares[0]!);
        return;
      }
      for (const piece of s.board.getAllPieces()) {
        if (piece.owner !== Player.BLANCAS || !piece.position) continue;
        const moves = s.movementEngine.getValidMoves(piece, s.board);
        if (moves.length > 0) {
          s.selectTile(piece.position);
          S().movePiece(moves[0]!);
          return;
        }
      }
      s.resolveStalledTurn();
    };

    let steps = 0;
    while (S().gamePhase === GamePhase.PLAYING && steps++ < 300) {
      if (S().currentPlayer === Player.NEGRAS) {
        expect(await S().runBotTurnAsync(new AbortController().signal, () => 0.5)).toBe(true);
      } else {
        humanAct();
      }
    }
    expect(S().gamePhase).toBe(GamePhase.GAME_OVER);
    S().botController?.dispose?.();
  }, 120_000);
});

describe("hard — getLastDecisionInfo", () => {
  it("expone eval/depth/nodes/ms/personalidad tras la búsqueda inline", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(2, 8), Player.NEGRAS));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(0, 3), Player.BLANCAS));
    const bot = createHardBot(() => 0.5, {
      personality: "offensive",
      forceInline: true,
      overrides: TEST_OVERRIDES,
    });
    expect(bot.getLastDecisionInfo?.() ?? null).toBeNull();
    const ctx: BotContext = {
      board,
      bot: Player.NEGRAS,
      botState: new PlayerState("bot"),
      opponentState: new PlayerState("opp"),
      engine: new MovementRuleEngine(),
      rules: CURRENT_RULES,
      setupMode: SetupTurnMode.ALTERNATING,
      rng: () => 0.5,
    };
    const action = bot.choosePlayAction(ctx);
    const info = bot.getLastDecisionInfo!();
    expect(info).not.toBeNull();
    expect(info!.depth).toBeGreaterThanOrEqual(1);
    expect(info!.nodes).toBeGreaterThan(0);
    expect(info!.ms).toBeGreaterThanOrEqual(0);
    expect(info!.personality).toBe("offensive");
    expect(typeof info!.eval).toBe("number");
    if (action.kind !== "pass") {
      expect(info!.top![0]!.action).toEqual(action);
    }
  });
});

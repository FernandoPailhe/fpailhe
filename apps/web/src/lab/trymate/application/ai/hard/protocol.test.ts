import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../../domain/constants/GameRules";
import { CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import type { SimState } from "../sim/SimState";
import type { BotContext } from "../ComputerPlayer";
import { getRulesInsight } from "../introspection/profiles";
import { createSeededRng } from "../rng";
import { SearchBoard } from "./SearchBoard";
import { searchHard } from "./search";
import { getPersonalityProfile } from "./personalities";
import { loadHardWeights } from "./weights";
import { rulesFingerprint } from "../../../domain/config/RulesView";
import { TranspositionTable } from "./transposition";
import { runHardRequest } from "./runHardRequest";
import { toHardRequest, type HardRequest } from "./protocol";

const rules = CURRENT_RULES;
const engine = new MovementRuleEngine();
const BOT = Player.NEGRAS;
const HUMAN = Player.BLANCAS;
const pos = (x: number, y: number) => new Position(x, y);

const boardOf = (...pieces: GamePiece[]): Board => {
  const board = new Board(rules.width, rules.height);
  pieces.forEach((p) => board.addPiece(p));
  return board;
};

const makeCtx = (board: Board, botState: PlayerState): BotContext => ({
  board,
  bot: BOT,
  botState,
  opponentState: new PlayerState("opp"),
  engine,
  rules,
  setupMode: SetupTurnMode.ALTERNATING,
  rng: createSeededRng(1),
});

const BUDGET = { kind: "nodes", n: 4_000 } as const;

describe("hard/protocol + runHardRequest", () => {
  const board = boardOf(
    new GamePiece("n1", PieceType.STRIKER, pos(2, 5), BOT),
    new GamePiece("n2", PieceType.FORT, pos(0, 6), BOT),
    new GamePiece("b1", PieceType.PIONEER, pos(1, 4), HUMAN),
    new GamePiece("b2", PieceType.FORT, pos(4, 3), HUMAN),
  );
  const ctx = makeCtx(board, new PlayerState("bot"));

  it("toHardRequest produce un payload plano y structuredClone-able", () => {
    const req = toHardRequest(ctx, BUDGET, 42, 7, "balanced");
    const clone = structuredClone(req) as HardRequest;
    expect(clone.id).toBe(7);
    expect(clone.kind).toBe("play");
    expect(clone.bot).toBe(BOT);
    expect(clone.seed).toBe(42);
    expect(clone.personality).toBe("balanced");
    expect(clone.board.pieces).toHaveLength(4);
    expect(clone.board.pieces[0]).toMatchObject({ type: PieceType.STRIKER, x: 2, y: 5 });
    expect(clone.pieceConfig).toEqual(engine.config);
    expect(clone.rulesSource.POINTS_TO_WIN).toBe(rules.pointsToWin);
    expect(clone.boardDims.BOARD_WIDTH).toBe(rules.width);
  });

  it("runHardRequest da el mismo resultado que searchHard directo (modo nodos)", () => {
    const req = structuredClone(toHardRequest(ctx, BUDGET, 42, 1, "balanced")) as HardRequest;
    const viaWorker = runHardRequest(req);
    expect("actions" in viaWorker).toBe(true);
    if (!("actions" in viaWorker)) return;

    const sim: SimState = {
      rules,
      board: boardOf(
        new GamePiece("n1", PieceType.STRIKER, pos(2, 5), BOT),
        new GamePiece("n2", PieceType.FORT, pos(0, 6), BOT),
        new GamePiece("b1", PieceType.PIONEER, pos(1, 4), HUMAN),
        new GamePiece("b2", PieceType.FORT, pos(4, 3), HUMAN),
      ),
      current: BOT,
      scores: { [BOT]: 0, [HUMAN]: 0 },
      bench: { [BOT]: [], [HUMAN]: [] },
      winner: null,
    };
    const direct = searchHard(
      new SearchBoard(sim, engine),
      BOT,
      getRulesInsight(rules, engine, engine.config),
      loadHardWeights(rulesFingerprint(rules, engine.config)).weights,
      getPersonalityProfile("balanced"),
      { kind: "nodes", n: BUDGET.n },
      createSeededRng(42),
      new TranspositionTable(),
    );

    expect(viaWorker.actions).toEqual(direct.actions);
    expect(viaWorker.score).toBe(direct.score);
    expect(viaWorker.depth).toBe(direct.depth);
  });

  it("kind setup → SerializedArmyPlan válido para las reglas", () => {
    // Contexto de SETUP: tablero aún sin piezas del bot.
    const setupCtx = makeCtx(new Board(rules.width, rules.height), new PlayerState("bot"));
    const req = structuredClone(
      toHardRequest(setupCtx, BUDGET, 21, 3, "defensive", "setup", {
        candidates: 4,
        nodesPerEval: 100,
      }),
    ) as HardRequest;
    const res = runHardRequest(req);
    expect("boardPieces" in res).toBe(true);
    if ("boardPieces" in res) {
      expect(res.boardPieces).toHaveLength(rules.piecesToPlace);
      expect(res.benchPieces).toHaveLength(rules.benchSize);
      const rows = rules.placementRows(BOT);
      expect(res.boardPieces.every((p) => rows.includes(p.y))).toBe(true);
    }
  });

  it("runHardRequest reconstruye la banca y los puntajes del request", () => {
    const ps = new PlayerState("bot");
    ps.addBenchPiece(new GamePiece("bb", PieceType.FORT, null, BOT));
    const ctx2 = makeCtx(boardOf(new GamePiece("n1", PieceType.STRIKER, pos(2, 5), BOT)), ps);
    const req = toHardRequest(ctx2, BUDGET, 5, 2, "offensive");
    expect(req.bench[BOT]).toEqual([PieceType.FORT]);
    expect(req.bench[HUMAN]).toEqual([]);
    const res = runHardRequest(structuredClone(req) as HardRequest);
    expect("actions" in res && res.actions.length > 0).toBe(true);
  });
});

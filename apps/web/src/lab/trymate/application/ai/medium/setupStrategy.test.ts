import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { GAME_RULES, SetupTurnMode } from "../../../domain/constants/GameRules";
import { buildRulesView, CURRENT_RULES, type RulesView } from "../../../domain/config/RulesView";
import { isCompositionFeasible, countsOf } from "../../../domain/rules/composition";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import { getRulesInsight } from "../introspection/profiles";
import type { BotContext } from "../ComputerPlayer";
import { chooseBenchType, chooseSetupPlacement, targetComposition } from "./setupStrategy";

const engine = new MovementRuleEngine();
const insight = getRulesInsight(CURRENT_RULES, engine, engine.config);
const pos = (x: number, y: number) => new Position(x, y);
const BOT = Player.NEGRAS;

const makeCtx = (
  board: Board,
  botState: PlayerState,
  rules: RulesView = CURRENT_RULES,
  setupMode: SetupTurnMode = SetupTurnMode.ALTERNATING,
  eng: MovementRuleEngine = engine,
  rng = () => 0.5,
): BotContext => ({
  board,
  bot: BOT,
  botState,
  opponentState: new PlayerState("opp"),
  engine: eng,
  rules,
  setupMode,
  rng,
});

/** Despliega el ejército completo como haría el store. */
function deployAll(ctx: BotContext, rules: RulesView): { board: string[]; bench: string[] } {
  const placed: string[] = [];
  for (let i = 0; i < rules.piecesToPlace; i++) {
    const next = chooseSetupPlacement(ctx, insight);
    expect(next).not.toBeNull();
    expect(rules.placementRows(BOT)).toContain(next!.position.y);
    expect(ctx.board.getPieceAt(next!.position)).toBeUndefined();
    const piece = new GamePiece(`p-${i}`, next!.type, next!.position, BOT);
    ctx.board.addPiece(piece);
    ctx.botState.addSelectedPiece(next!.type);
    ctx.botState.addPlacedPiece(piece);
    placed.push(next!.type);
  }
  const bench: string[] = [];
  for (let i = 0; i < rules.benchSize; i++) {
    const type = chooseBenchType(ctx, insight);
    expect(type).not.toBeNull();
    bench.push(type!);
    ctx.botState.addBenchPiece(new GamePiece(`b-${i}`, type!, null, BOT));
  }
  return { board: placed, bench };
}

describe("targetComposition", () => {
  it("suma piecesToPlace + benchSize dentro de min/max por tipo", () => {
    const target = targetComposition(insight);
    let sum = 0;
    for (const type of CURRENT_RULES.pieceTypes) {
      expect(target[type]).toBeGreaterThanOrEqual(CURRENT_RULES.minPerType);
      expect(target[type]).toBeLessThanOrEqual(CURRENT_RULES.maxPerType);
      sum += target[type];
    }
    expect(sum).toBe(CURRENT_RULES.piecesToPlace + CURRENT_RULES.benchSize);
  });
});

describe("chooseSetupPlacement — reglas actuales", () => {
  it("el primer bloqueador va a la fila frontal cubriendo carriles", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    const ctx = makeCtx(board, new PlayerState("bot"));
    const next = chooseSetupPlacement(ctx, insight);
    expect(next).not.toBeNull();
    // FORT es el único con rol blocker: sale adelante (fila 7) al centro.
    expect(next!.type).toBe(PieceType.FORT);
    const frontRow = CURRENT_RULES.placementRows(BOT)[0]!;
    expect(next!.position.y).toBe(frontRow);
    expect(next!.position.x).toBeGreaterThanOrEqual(1);
    expect(next!.position.x).toBeLessThanOrEqual(3);
  });

  it("con PIONEER rival en el borde, el primer bloqueador lo cubre", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    // PIONEER blanco en columna 0: matchup(FORT, PIONEER) = +1 en |dx| ≤ 2.
    board.addPiece(new GamePiece("w", PieceType.PIONEER, pos(0, 2), Player.BLANCAS));
    const ctx = makeCtx(board, new PlayerState("bot"));
    const next = chooseSetupPlacement(ctx, insight);
    expect(next!.type).toBe(PieceType.FORT);
    expect(next!.position.x).toBeLessThanOrEqual(2);
  });

  it("despliegue completo + banca: válido y composición factible", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    const ps = new PlayerState("bot");
    const ctx = makeCtx(board, ps);
    const { board: placed, bench } = deployAll(ctx, CURRENT_RULES);
    expect(placed).toHaveLength(CURRENT_RULES.piecesToPlace);
    expect(bench).toHaveLength(CURRENT_RULES.benchSize);
    const all = [...placed, ...bench] as PieceType[];
    const counts = countsOf(all, CURRENT_RULES);
    for (const type of CURRENT_RULES.pieceTypes) {
      expect(counts[type]).toBeGreaterThanOrEqual(CURRENT_RULES.minPerType);
      expect(counts[type]).toBeLessThanOrEqual(CURRENT_RULES.maxPerType);
    }
  });

  it("HIDDEN: tablero solo con piezas propias → colocación válida", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    const ctx = makeCtx(board, new PlayerState("bot"), CURRENT_RULES, SetupTurnMode.HIDDEN);
    const next = chooseSetupPlacement(ctx, insight);
    expect(next).not.toBeNull();
    expect(CURRENT_RULES.placementRows(BOT)).toContain(next!.position.y);
  });
});

describe("chooseBenchType", () => {
  it("devuelve tipos factibles y completa la composición", () => {
    const board = new Board(CURRENT_RULES.width, CURRENT_RULES.height);
    const ps = new PlayerState("bot");
    const ctx = makeCtx(board, ps);
    deployAll(ctx, CURRENT_RULES); // deja la composición completa y válida
    const chosen = ps.getSelectedPieces().concat(ps.getBenchPieces().map((p) => p.type));
    for (const type of CURRENT_RULES.pieceTypes) {
      const n = chosen.filter((t) => t === type).length;
      expect(n).toBeGreaterThanOrEqual(CURRENT_RULES.minPerType);
      expect(n).toBeLessThanOrEqual(CURRENT_RULES.maxPerType);
    }
  });
});

describe("variantes de reglas", () => {
  it("7×13: despliegue completo válido", () => {
    const rules = buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES);
    const vi = getRulesInsight(rules, engine, engine.config);
    const board = new Board(rules.width, rules.height);
    const ps = new PlayerState("bot");
    const ctx = makeCtx(board, ps, rules);
    const { board: placed, bench } = (() => {
      const p: string[] = [];
      for (let i = 0; i < rules.piecesToPlace; i++) {
        const next = chooseSetupPlacement(ctx, vi);
        expect(next).not.toBeNull();
        const squares = getBenchPlacementSquares(board, BOT, rules);
        expect(squares.some((s) => s.equals(next!.position))).toBe(true);
        const piece = new GamePiece(`p-${i}`, next!.type, next!.position, BOT);
        board.addPiece(piece);
        ps.addSelectedPiece(next!.type);
        ps.addPlacedPiece(piece);
        p.push(next!.type);
      }
      const b: string[] = [];
      for (let i = 0; i < rules.benchSize; i++) {
        const type = chooseBenchType(ctx, vi);
        expect(type).not.toBeNull();
        b.push(type!);
        ps.addBenchPiece(new GamePiece(`b-${i}`, type!, null, BOT));
      }
      return { board: p, bench: b };
    })();
    const counts = countsOf([...placed, ...bench] as PieceType[], rules);
    expect(isCompositionFeasible(counts, 0, rules)).toBe(true);
  });

  it("minPerType 3 con 9 piezas: composición completa factible", () => {
    const rules = buildRulesView(
      { BOARD_WIDTH: 5, BOARD_HEIGHT: 11 },
      { ...GAME_RULES, MIN_PIECES_PER_TYPE: 3, PIECES_TO_PLACE: 6, PIECES_IN_BENCH: 3 },
    );
    const vi = getRulesInsight(rules, engine, engine.config);
    const target = targetComposition(vi);
    for (const type of rules.pieceTypes) {
      expect(target[type]).toBe(3);
    }
    const board = new Board(rules.width, rules.height);
    const ps = new PlayerState("bot");
    const ctx = makeCtx(board, ps, rules);
    const placed: PieceType[] = [];
    for (let i = 0; i < rules.piecesToPlace; i++) {
      const next = chooseSetupPlacement(ctx, vi);
      expect(next).not.toBeNull();
      const piece = new GamePiece(`p-${i}`, next!.type, next!.position, BOT);
      board.addPiece(piece);
      ps.addSelectedPiece(next!.type);
      ps.addPlacedPiece(piece);
      placed.push(next!.type);
    }
    const bench: PieceType[] = [];
    for (let i = 0; i < rules.benchSize; i++) {
      const type = chooseBenchType(ctx, vi);
      expect(type).not.toBeNull();
      bench.push(type!);
      ps.addBenchPiece(new GamePiece(`b-${i}`, type!, null, BOT));
    }
    const counts = countsOf([...placed, ...bench], rules);
    expect(isCompositionFeasible(counts, 0, rules)).toBe(true);
  });
});

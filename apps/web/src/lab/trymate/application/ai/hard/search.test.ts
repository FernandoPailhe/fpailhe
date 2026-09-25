import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { Position } from "../../../domain/entities/Position";
import { PIECE_MOVEMENT_CONFIG, PieceType, Player } from "../../../domain/constants/PieceConstants";
import { CURRENT_RULES, rulesFingerprint } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getBenchPlacementSquares } from "../../rules/turnRules";
import type { SimState } from "../sim/SimState";
import { getRulesInsight } from "../introspection/profiles";
import { createSeededRng } from "../rng";
import { RULE_VARIANTS } from "../testing/ruleVariants";
import { SearchBoard } from "./SearchBoard";
import { searchHard, type HardSearchResult } from "./search";
import { getPersonalityProfile } from "./personalities";
import { DEFAULT_HARD_WEIGHTS } from "./weights";
import { TranspositionTable } from "./transposition";

/**
 * Escenarios anclados a las reglas actuales (mismo fingerprint que Medium):
 * si cambian, se saltean con aviso para re-anclarlos.
 */
const EXPECTED_FINGERPRINT =
  '{"width":5,"height":11,"pieceTypes":["FORT","STRIKER","PIONEER"],"piecesToPlace":5,"benchSize":3,"minPerType":2,"maxPerType":4,"maxPerRow":2,"pointsToWin":3,"placementRows":{"BLANCAS":[1,2,3],"NEGRAS":[7,8,9]},"homeRow":{"BLANCAS":0,"NEGRAS":10},"scoringRow":{"BLANCAS":10,"NEGRAS":0},"pieceConfig":{"FORT":{"movement":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":1,"canCapture":false},"capture":{"directions":[{"dx":1,"dy":1},{"dx":-1,"dy":1}],"minDistance":1,"maxDistance":1},"blocksSides":true,"blockedSideOffsets":[{"dx":-1,"dy":0},{"dx":1,"dy":0}],"captureIgnoresSideBlock":true},"STRIKER":{"movement":{"directions":[{"dx":0,"dy":1},{"dx":1,"dy":1},{"dx":-1,"dy":1}],"minDistance":1,"maxDistance":1,"canCapture":false},"alternativeMovement":{"directions":[{"dx":0,"dy":1}],"minDistance":2,"maxDistance":2,"canCapture":false,"requiresClearPath":true},"capture":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":1},"blocksSides":false},"PIONEER":{"movement":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":3,"canCapture":false},"blocksSides":false,"lShape":true,"maxLateral":1,"maxTotalDistance":3,"canBypassBlocker":true,"bypassMinDistance":2}}}';

const rulesChanged =
  rulesFingerprint(CURRENT_RULES, PIECE_MOVEMENT_CONFIG) !== EXPECTED_FINGERPRINT;
if (rulesChanged) {
  console.warn("[hard-search] Las reglas cambiaron: revisar y re-anclar estos escenarios.");
}

const rules = CURRENT_RULES;
const engine = new MovementRuleEngine();
const insight = getRulesInsight(rules, engine, engine.config);
const BOT = Player.NEGRAS;
const HUMAN = Player.BLANCAS;
const pos = (x: number, y: number) => new Position(x, y);

const boardOf = (...pieces: GamePiece[]): Board => {
  const board = new Board(rules.width, rules.height);
  pieces.forEach((p) => board.addPiece(p));
  return board;
};

const mkSb = (
  board: Board,
  opts: Partial<Pick<SimState, "current" | "scores" | "bench">> = {},
): SearchBoard =>
  new SearchBoard(
    {
      rules,
      board,
      current: opts.current ?? BOT,
      scores: opts.scores ?? { [BOT]: 0, [HUMAN]: 0 },
      bench: opts.bench ?? { [BOT]: [], [HUMAN]: [] },
      winner: null,
    },
    engine,
  );

const search = (
  sb: SearchBoard,
  personality: "balanced" | "offensive" | "defensive" = "balanced",
  n = 30_000,
  tt?: TranspositionTable,
): HardSearchResult =>
  searchHard(
    sb,
    sb.current,
    insight,
    DEFAULT_HARD_WEIGHTS,
    getPersonalityProfile(personality),
    { kind: "nodes", n },
    createSeededRng(3),
    tt,
  );

const firstMove = (r: HardSearchResult) => {
  const a = r.actions[r.actions.length - 1]!;
  if (a.kind !== "move") throw new Error(`expected move, got ${a.kind}`);
  return a;
};

const MATE = 50_000;

describe.skipIf(rulesChanged)("Hard search — táctica (reglas actuales)", () => {
  it("captura gratis: toma la pieza indefensa", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT),
      new GamePiece("w", PieceType.FORT, pos(2, 4), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(0, 8), HUMAN),
      new GamePiece("z", PieceType.PIONEER, pos(4, 1), HUMAN),
    );
    const a = firstMove(search(mkSb(board)));
    expect(a.pieceId).toBe("s");
    expect(a.to.x).toBe(2);
    expect(a.to.y).toBe(4);
  });

  it("horizonte: no captura lo que se recaptura (SEE < 0)", () => {
    // N FORT (2,5) podría capturar STRIKER (1,4), pero esa casilla la cubre
    // el FORT rival (0,3): 28 − 31 < 0.
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(2, 5), BOT),
      new GamePiece("p", PieceType.PIONEER, pos(4, 7), BOT),
      new GamePiece("s", PieceType.STRIKER, pos(1, 4), HUMAN),
      new GamePiece("d", PieceType.FORT, pos(0, 3), HUMAN),
    );
    const a = firstMove(search(mkSb(board)));
    expect(a.pieceId === "f" && a.to.x === 1 && a.to.y === 4).toBe(false);
  });

  it("combinación: captura al defensor que tapona la meta y después anota", () => {
    // N STRIKER (2,2) captura gratis al FORT (2,1) que cierra su columna;
    // con 2 puntos, anotar gana la partida en la línea siguiente.
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 2), BOT),
      new GamePiece("p", PieceType.FORT, pos(0, 9), BOT),
      new GamePiece("w", PieceType.FORT, pos(2, 1), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(4, 8), HUMAN),
    );
    const r = search(mkSb(board, { scores: { [BOT]: 2, [HUMAN]: 0 } }));
    const a = firstMove(r);
    expect(a.pieceId).toBe("s");
    expect(a.to.x).toBe(2);
    expect(a.to.y).toBe(1);
    expect(r.score).toBeGreaterThan(MATE);
  });

  it("banca: sin movimientos legales baja una pieza antes de pasar", () => {
    // El FORT bot está enfrentado (0 movimientos); la banca es la única acción.
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(1, 5), BOT),
      new GamePiece("w", PieceType.FORT, pos(1, 4), HUMAN),
      new GamePiece("r", PieceType.PIONEER, pos(3, 6), HUMAN),
    );
    const r = search(mkSb(board, { bench: { [BOT]: [PieceType.PIONEER], [HUMAN]: [] } }));
    expect(r.actions[0]!.kind).toBe("bench");
    if (r.actions[0]!.kind === "bench") {
      expect(r.actions[0]!.type).toBe(PieceType.PIONEER);
    }
  });

  it("anota para ganar con 2 puntos y pieza a 1 de la meta", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(0, 1), BOT),
      new GamePiece("w", PieceType.FORT, pos(4, 8), HUMAN),
    );
    const r = search(mkSb(board, { scores: { [BOT]: 2, [HUMAN]: 0 } }));
    const a = firstMove(r);
    expect(a.pieceId).toBe("s");
    expect(a.to.y).toBe(rules.scoringRow(BOT));
    expect(r.score).toBeGreaterThan(MATE);
  });

  it("frena corredor: el FORT actúa sobre el striker rival a 2 de anotar", () => {
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(1, 9), BOT),
      new GamePiece("s", PieceType.STRIKER, pos(2, 8), HUMAN),
      new GamePiece("x", PieceType.FORT, pos(4, 3), HUMAN),
    );
    const a = firstMove(search(mkSb(board)));
    // Captura directa (2,8) o avance a (1,8) para interceptar el carril.
    expect(a.pieceId).toBe("f");
    expect(a.to.y).toBe(8);
    expect(a.to.x).toBeLessThanOrEqual(2);
  });

  it("gana su carrera: anota antes que el corredor rival", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 1), BOT),
      new GamePiece("f", PieceType.FORT, pos(0, 5), BOT),
      new GamePiece("r", PieceType.PIONEER, pos(4, 9), HUMAN),
      new GamePiece("w", PieceType.FORT, pos(1, 4), HUMAN),
    );
    const r = search(mkSb(board, { scores: { [BOT]: 2, [HUMAN]: 2 } }));
    const a = firstMove(r);
    expect(a.pieceId).toBe("s");
    expect(a.to.y).toBe(rules.scoringRow(BOT));
    expect(r.score).toBeGreaterThan(MATE);
  });
});

describe.skipIf(rulesChanged)("Hard search — determinismo y TT", () => {
  const mid = () =>
    boardOf(
      new GamePiece("a", PieceType.FORT, pos(1, 5), BOT),
      new GamePiece("b", PieceType.STRIKER, pos(2, 7), BOT),
      new GamePiece("c", PieceType.PIONEER, pos(4, 8), BOT),
      new GamePiece("d", PieceType.FORT, pos(0, 4), HUMAN),
      new GamePiece("e", PieceType.STRIKER, pos(3, 5), HUMAN),
      new GamePiece("f", PieceType.PIONEER, pos(2, 2), HUMAN),
    );

  it("determinista: misma semilla y presupuesto → mismo resultado", { timeout: 30_000 }, () => {
    const r1 = search(mkSb(mid()));
    const r2 = search(mkSb(mid()));
    expect(JSON.stringify(r1.actions)).toBe(JSON.stringify(r2.actions));
    expect(r1.score).toBe(r2.score);
    expect(r1.depth).toBe(r2.depth);
  });

  it(
    "TT: mismo score a igual profundidad y alcanza igual o más profundidad",
    { timeout: 30_000 },
    () => {
      const withTt = search(mkSb(mid()), "balanced", 30_000);
      const without = search(mkSb(mid()), "balanced", 30_000, new TranspositionTable(0));
      expect(withTt.depth).toBeGreaterThanOrEqual(without.depth);
      if (withTt.depth === without.depth) {
        expect(withTt.score).toBe(without.score);
      }
    },
  );

  it("respeta el presupuesto de nodos", { timeout: 30_000 }, () => {
    const r = search(mkSb(mid()), "balanced", 10_000);
    expect(r.nodes).toBeLessThanOrEqual(10_000 + 64);
  });
});

describe.skipIf(rulesChanged)("Hard search — personalidades", () => {
  it("contempt: bloqueo mutuo vale −60 offensive, +30 defensive, 0 balanced", () => {
    // La única jugada de N deja todos los pares de FORT enfrentados: bloqueo
    // mutuo alcanzable en 1 ply.
    const board = boardOf(
      new GamePiece("a", PieceType.FORT, pos(1, 5), BOT),
      new GamePiece("b", PieceType.FORT, pos(3, 5), BOT),
      new GamePiece("e", PieceType.FORT, pos(4, 7), BOT),
      new GamePiece("c", PieceType.FORT, pos(1, 4), HUMAN),
      new GamePiece("d", PieceType.FORT, pos(3, 4), HUMAN),
      new GamePiece("f", PieceType.FORT, pos(4, 5), HUMAN),
    );
    const off = search(mkSb(board), "offensive");
    const def = search(mkSb(board), "defensive");
    const bal = search(mkSb(board), "balanced");
    expect(off.score).toBeLessThan(bal.score);
    expect(def.score).toBeGreaterThan(bal.score);
    expect(bal.score).toBe(0);
  });
});

describe("Hard search — variantes de reglas (legalidad)", () => {
  it("solo produce acciones legales en cada variante", { timeout: 60_000 }, () => {
    for (const v of RULE_VARIANTS) {
      const eng = new MovementRuleEngine();
      const ins = getRulesInsight(v.rules, eng, eng.config);
      const types = v.rules.pieceTypes;
      const midX = Math.floor(v.rules.width / 2);
      const midY = Math.floor(v.rules.height / 2);
      const board = new Board(v.rules.width, v.rules.height);
      board.addPiece(new GamePiece("a", types[0]!, pos(0, midY - 1), BOT));
      board.addPiece(
        new GamePiece("b", types[Math.min(1, types.length - 1)]!, pos(midX, midY + 1), BOT),
      );
      board.addPiece(new GamePiece("c", types[0]!, pos(v.rules.width - 1, midY), HUMAN));
      board.addPiece(
        new GamePiece("d", types[types.length - 1]!, pos(Math.max(0, midX - 1), midY - 2), HUMAN),
      );
      const mk = () =>
        new SearchBoard(
          {
            rules: v.rules,
            board,
            current: BOT,
            scores: { [BOT]: 0, [HUMAN]: 0 },
            bench: { [BOT]: [types[0]!], [HUMAN]: [] },
            winner: null,
          },
          eng,
        );
      const r = searchHard(
        mk(),
        BOT,
        ins,
        DEFAULT_HARD_WEIGHTS,
        getPersonalityProfile("balanced"),
        { kind: "nodes", n: 8_000 },
        createSeededRng(5),
      );
      expect(r.actions.length).toBeGreaterThan(0);
      const fresh = mk();
      for (const a of r.actions) {
        if (a.kind === "move") {
          const piece = fresh.board.getPieceById(a.pieceId)!;
          const legal = eng
            .getValidMoves(piece, fresh.board)
            .some((m) => m.x === a.to.x && m.y === a.to.y);
          expect(legal, `${v.name}: jugada ilegal ${JSON.stringify(a)}`).toBe(true);
        } else if (a.kind === "bench") {
          const squares = getBenchPlacementSquares(fresh.board, BOT, v.rules);
          expect(
            squares.some((s) => s.x === a.to.x && s.y === a.to.y),
            `${v.name}: banca ilegal ${JSON.stringify(a)}`,
          ).toBe(true);
          expect(fresh.bench[BOT]).toContain(a.type);
        }
        const undo = fresh.make(a);
        expect(undo, `${v.name}: make() rechazó ${JSON.stringify(a)}`).not.toBeNull();
      }
    }
  });
});

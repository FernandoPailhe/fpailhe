import { describe, expect, it } from "vitest";
import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { PlayerState } from "../../domain/entities/PlayerState";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { SetupTurnMode } from "../../domain/constants/GameRules";
import { CURRENT_RULES } from "../../domain/config/RulesView";
import { MovementRuleEngine } from "../rules/MovementRuleEngine";
import { choosePlayAction, createEasyBot, EASY_BOT_CONFIG, getThreatenedSquares } from "./EasyBot";
import type { BotContext } from "./ComputerPlayer";
import type { Rng } from "./rng";

const engine = new MovementRuleEngine();

const emptyBoard = () => new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
const pos = (x: number, y: number) => new Position(x, y);

/** Estado con `count` piezas de banca (y las mismas en selectedPieces). */
const withBench = (count: number): PlayerState => {
  const ps = new PlayerState("p");
  for (let i = 0; i < count; i++) {
    ps.addSelectedPiece(PieceType.FORT);
    ps.addBenchPiece(new GamePiece(`b-${i}`, PieceType.FORT, null, Player.BLANCAS));
  }
  return ps;
};

const makeCtx = (
  board: Board,
  bot: Player,
  botState: PlayerState,
  rng: Rng = () => 0.9999,
): BotContext => ({
  board,
  bot,
  botState,
  opponentState: new PlayerState("opponent"),
  engine,
  rules: CURRENT_RULES,
  setupMode: SetupTurnMode.ALTERNATING,
  rng,
});

describe("getThreatenedSquares", () => {
  it("marca las diagonales del FORT y el frente del STRIKER", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("w-f", PieceType.FORT, pos(2, 5), Player.BLANCAS));
    board.addPiece(new GamePiece("w-s", PieceType.STRIKER, pos(0, 8), Player.BLANCAS));
    const t = getThreatenedSquares(board, Player.NEGRAS, engine);
    expect(t.has("1,6")).toBe(true); // diagonal FORT
    expect(t.has("3,6")).toBe(true); // diagonal FORT
    expect(t.has("0,9")).toBe(true); // frente STRIKER
    expect(t.has("2,5")).toBe(false);
  });

  it("la casilla bloqueada lateralmente por un FORT rival no es amenaza del STRIKER", () => {
    const board = emptyBoard();
    // FORT NEGRAS en (2,5) bloquea lateralmente (1,5) y (3,5) a piezas
    // BLANCAS; el STRIKER BLANCO en (1,4) apunta a (1,5) pero no puede
    // capturar ahí. El FORT BLANCO en (0,7) sí amenaza (1,8).
    board.addPiece(new GamePiece("b-f", PieceType.FORT, pos(2, 5), Player.NEGRAS));
    board.addPiece(new GamePiece("w-s", PieceType.STRIKER, pos(1, 4), Player.BLANCAS));
    board.addPiece(new GamePiece("w-f", PieceType.FORT, pos(0, 7), Player.BLANCAS));
    const t = getThreatenedSquares(board, Player.NEGRAS, engine);
    expect(t.has("1,5")).toBe(false); // captura taponeada por el FORT rival
    expect(t.has("1,8")).toBe(true); // diagonal del FORT sí amenaza
  });

  it("ignora piezas propias y sin posición", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("b-s", PieceType.STRIKER, pos(0, 2), Player.NEGRAS));
    const t = getThreatenedSquares(board, Player.NEGRAS, engine);
    expect(t.size).toBe(0);
  });
});

describe("choosePlayAction", () => {
  it("prioriza anotar en la última fila sobre capturar", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(0, 9), Player.BLANCAS));
    board.addPiece(new GamePiece("c", PieceType.STRIKER, pos(3, 8), Player.BLANCAS));
    board.addPiece(new GamePiece("e", PieceType.FORT, pos(3, 9), Player.NEGRAS));
    // score 100+3 vs capture 30+3: con topK 1 el pick es determinista.
    const action = choosePlayAction(makeCtx(board, Player.BLANCAS, withBench(0)), {
      ...EASY_BOT_CONFIG,
      topK: 1,
    });
    expect(action).toEqual({ kind: "move", pieceId: "s", to: pos(0, 10) });
  });

  it("evita una casilla amenazada aunque empate en avance", () => {
    const board = emptyBoard();
    // FORT NEGRAS en (1,6) amenaza (0,5) y (2,5): el único movimiento de "a"
    // cae en casilla amenazada (-15), así que gana mover "b".
    board.addPiece(new GamePiece("a", PieceType.FORT, pos(0, 4), Player.BLANCAS));
    board.addPiece(new GamePiece("b", PieceType.FORT, pos(4, 4), Player.BLANCAS));
    board.addPiece(new GamePiece("w", PieceType.FORT, pos(1, 6), Player.NEGRAS));
    const action = choosePlayAction(makeCtx(board, Player.BLANCAS, withBench(0)), {
      ...EASY_BOT_CONFIG,
      topK: 1,
    });
    expect(action).toEqual({ kind: "move", pieceId: "b", to: pos(4, 5) });
  });

  it("con rng < randomMoveChance elige cualquier candidato", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(0, 9), Player.BLANCAS));
    board.addPiece(new GamePiece("p", PieceType.PIONEER, pos(2, 4), Player.BLANCAS));
    const action = choosePlayAction(makeCtx(board, Player.BLANCAS, withBench(0), () => 0));
    expect(action.kind).toBe("move");
    if (action.kind === "move") expect(action.pieceId).toBe("s"); // primer candidato
  });

  it("cae a banca cuando hay pieza en banca y casilla legal", () => {
    const board = emptyBoard();
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(0, 9), Player.BLANCAS));
    const action = choosePlayAction(makeCtx(board, Player.BLANCAS, withBench(1)));
    expect(action.kind).toBe("bench");
    if (action.kind === "bench") {
      expect(action.benchPieceId).toBe("b-0");
      expect(action.to.y).toBe(3); // fila de despliegue más adelantada
    }
  });

  it("banca usa la fila de despliegue libre más cercana al frente", () => {
    const board = emptyBoard();
    // Llenar las filas 2 y 3 con maxPerRow propias (4 piezas < 5 en tablero,
    // así la banca sigue habilitada) → la única fila con hueco es la 1.
    for (let x = 0; x < CURRENT_RULES.maxPerRow; x++) {
      board.addPiece(new GamePiece(`o2-${x}`, PieceType.FORT, pos(x, 2), Player.BLANCAS));
      board.addPiece(new GamePiece(`o3-${x}`, PieceType.FORT, pos(x, 3), Player.BLANCAS));
    }
    const action = choosePlayAction(makeCtx(board, Player.BLANCAS, withBench(1)));
    expect(action.kind).toBe("bench");
    if (action.kind === "bench") expect(action.to.y).toBe(1);
  });

  it("pasa cuando no hay banca ni movimientos legales", () => {
    const action = choosePlayAction(makeCtx(emptyBoard(), Player.BLANCAS, withBench(0)));
    expect(action).toEqual({ kind: "pass" });
  });
});

describe("createEasyBot", () => {
  const makeSetupCtx = (
    board: Board,
    ps: PlayerState,
    bot: Player = Player.NEGRAS,
    setupMode: SetupTurnMode = SetupTurnMode.ALTERNATING,
  ): BotContext => ({
    board,
    bot,
    botState: ps,
    opponentState: new PlayerState("opp"),
    engine,
    rules: CURRENT_RULES,
    setupMode,
    rng: () => 0.5,
  });

  it("despliega piezas solo en filas válidas y tipos factibles", () => {
    const bot = createEasyBot(() => 0.5);
    const board = emptyBoard();
    const ps = new PlayerState("bot");
    const ctx = makeSetupCtx(board, ps);

    for (let i = 0; i < CURRENT_RULES.piecesToPlace; i++) {
      const next = bot.chooseSetupPlacement(ctx);
      expect(next).not.toBeNull();
      expect(CURRENT_RULES.placementRows(Player.NEGRAS)).toContain(next!.position.y);
      expect(board.getPieceAt(next!.position)).toBeUndefined();
      const piece = new GamePiece(`p-${i}`, next!.type, next!.position, Player.NEGRAS);
      board.addPiece(piece);
      ps.addSelectedPiece(next!.type);
      ps.addPlacedPiece(piece);
    }
    expect(ps.getPlacedPiecesCount()).toBe(CURRENT_RULES.piecesToPlace);
  });

  it("elige tipos de banca respetando la composición", () => {
    const bot = createEasyBot(() => 0.5);
    const board = emptyBoard();
    const ps = new PlayerState("bot");
    const ctx = makeSetupCtx(board, ps);
    // Setup completo mínimo viable: 2 FORT + 2 STRIKER + 1 PIONEER.
    const setup = [
      PieceType.FORT,
      PieceType.FORT,
      PieceType.STRIKER,
      PieceType.STRIKER,
      PieceType.PIONEER,
    ];
    for (const [i, type] of setup.entries()) {
      const piece = new GamePiece(`s-${i}`, type, pos(i, 9), Player.NEGRAS);
      board.addPiece(piece);
      ps.addSelectedPiece(type);
      ps.addPlacedPiece(piece);
    }

    const bench: PieceType[] = [];
    for (let i = 0; i < CURRENT_RULES.benchSize; i++) {
      const type = bot.chooseBenchType(ctx);
      expect(type).not.toBeNull();
      bench.push(type!);
      // Como en el store: la banca solo se agrega a benchPieces.
      ps.addBenchPiece(new GamePiece(`b-${i}`, type!, null, Player.NEGRAS));
    }
    expect(bench).toHaveLength(CURRENT_RULES.benchSize);
    // Ningún tipo supera el máximo global.
    for (const type of CURRENT_RULES.pieceTypes) {
      const total = setup.filter((t) => t === type).length + bench.filter((t) => t === type).length;
      expect(total).toBeLessThanOrEqual(CURRENT_RULES.maxPerType);
    }
    // Mínimos cumplidos tras la composición completa.
    const counts = new Map<PieceType, number>();
    for (const t of [...setup, ...bench]) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const type of CURRENT_RULES.pieceTypes) {
      expect(counts.get(type) ?? 0).toBeGreaterThanOrEqual(CURRENT_RULES.minPerType);
    }
  });

  it("devuelve acciones de juego a través del controller", () => {
    const bot = createEasyBot(() => 0.5);
    const board = emptyBoard();
    board.addPiece(new GamePiece("s", PieceType.STRIKER, pos(0, 9), Player.NEGRAS));
    const action = bot.choosePlayAction(makeCtx(board, Player.NEGRAS, new PlayerState("bot")));
    expect(action.kind).toBe("move");
  });
});

import { describe, expect, it } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { PIECE_MOVEMENT_CONFIG, PieceType, Player } from "../../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../../domain/constants/GameRules";
import { CURRENT_RULES, rulesFingerprint } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import type { BotContext } from "../ComputerPlayer";
import { createMediumBot } from "../MediumBot";
import type { SimState } from "../sim/SimState";
import { getRulesInsight } from "../introspection/profiles";
import { createSeededRng } from "../rng";
import { SearchBoard } from "./SearchBoard";
import { searchHard, type HardSearchResult } from "./search";
import { getPersonalityProfile } from "./personalities";
import { DEFAULT_HARD_WEIGHTS } from "./weights";

/**
 * Tácticas profundas ancladas a las reglas actuales (mismo fingerprint que
 * Medium): si cambia el tablero/reglas/movimientos, se saltean con aviso.
 * Cada escenario loguea también qué eligió Medium — documenta qué
 * combinaciones ve Hard que Medium no.
 */
const EXPECTED_FINGERPRINT =
  '{"width":5,"height":11,"pieceTypes":["FORT","STRIKER","PIONEER"],"piecesToPlace":5,"benchSize":3,"minPerType":2,"maxPerType":4,"maxPerRow":2,"pointsToWin":3,"placementRows":{"BLANCAS":[1,2,3],"NEGRAS":[7,8,9]},"homeRow":{"BLANCAS":0,"NEGRAS":10},"scoringRow":{"BLANCAS":10,"NEGRAS":0},"pieceConfig":{"FORT":{"movement":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":1,"canCapture":false},"capture":{"directions":[{"dx":1,"dy":1},{"dx":-1,"dy":1}],"minDistance":1,"maxDistance":1},"blocksSides":true,"blockedSideOffsets":[{"dx":-1,"dy":0},{"dx":1,"dy":0}],"captureIgnoresSideBlock":true},"STRIKER":{"movement":{"directions":[{"dx":0,"dy":1},{"dx":1,"dy":1},{"dx":-1,"dy":1}],"minDistance":1,"maxDistance":1,"canCapture":false},"alternativeMovement":{"directions":[{"dx":0,"dy":1}],"minDistance":2,"maxDistance":2,"canCapture":false,"requiresClearPath":true},"capture":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":1},"blocksSides":false},"PIONEER":{"movement":{"directions":[{"dx":0,"dy":1}],"minDistance":1,"maxDistance":3,"canCapture":false},"blocksSides":false,"lShape":true,"maxLateral":1,"maxTotalDistance":3,"canBypassBlocker":true,"bypassMinDistance":2}}}';

const rulesChanged =
  rulesFingerprint(CURRENT_RULES, PIECE_MOVEMENT_CONFIG) !== EXPECTED_FINGERPRINT;
if (rulesChanged) {
  console.warn("[hard-tactics] Las reglas cambiaron: revisar y re-anclar estos escenarios.");
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
  board: Board,
  opts: Partial<Pick<SimState, "current" | "scores" | "bench">> = {},
  n = 40_000,
): HardSearchResult => {
  const sb = mkSb(board, opts);
  return searchHard(
    sb,
    sb.current,
    insight,
    DEFAULT_HARD_WEIGHTS,
    getPersonalityProfile("balanced"),
    { kind: "nodes", n },
    createSeededRng(3),
  );
};

const firstMove = (r: HardSearchResult) => {
  const a = r.actions[r.actions.length - 1]!;
  if (a.kind !== "move") throw new Error(`expected move, got ${a.kind}`);
  return a;
};

/** Qué haría Medium en la misma posición (log comparativo de la spec). */
const mediumPlays = (name: string, board: Board, scores?: Record<Player, number>): void => {
  const botState = new PlayerState("bot");
  const opponentState = new PlayerState("opp");
  if (scores) {
    for (let i = 0; i < scores[BOT]; i++) botState.incrementScore();
    for (let i = 0; i < scores[HUMAN]; i++) opponentState.incrementScore();
  }
  const ctx: BotContext = {
    board,
    bot: BOT,
    botState,
    opponentState,
    engine,
    rules,
    setupMode: SetupTurnMode.ALTERNATING,
    rng: () => 0.4,
  };
  const a = createMediumBot(createSeededRng(7)).choosePlayAction(ctx);
  const desc =
    a.kind === "move"
      ? `${a.pieceId}→(${a.to.x},${a.to.y})`
      : a.kind === "bench"
        ? `bench ${a.benchPieceId}→(${a.to.x},${a.to.y})`
        : "pass";
  console.warn(`[hard-tactics] ${name}: Medium eligió ${desc}`);
};

const MATE = 50_000;

describe.skipIf(rulesChanged)("Hard tactics — reglas actuales", () => {
  // ── Todas las tácticas de Medium (spec item 1) ──────────────────────

  it("frena corredor: el FORT actúa sobre el striker rival a 2 de anotar", () => {
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(1, 9), BOT),
      new GamePiece("s", PieceType.STRIKER, pos(2, 8), HUMAN),
      new GamePiece("x", PieceType.FORT, pos(4, 3), HUMAN),
    );
    mediumPlays("frena corredor", board);
    const a = firstMove(search(board));
    expect(a.pieceId).toBe("f");
    expect(a.to.y).toBe(8);
    expect(a.to.x).toBeLessThanOrEqual(2);
  });

  it("tapona: reduce los avances legales del striker rival", () => {
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(1, 9), BOT),
      new GamePiece("f2", PieceType.FORT, pos(4, 9), BOT),
      new GamePiece("s", PieceType.STRIKER, pos(2, 7), HUMAN),
    );
    mediumPlays("tapona", board);
    const a = firstMove(search(board));
    expect(a.pieceId).toBe("f");
  });

  it("no cuelga: no avanza a una casilla atacada sin defensa", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT),
      new GamePiece("w1", PieceType.FORT, pos(0, 3), HUMAN),
      new GamePiece("w2", PieceType.FORT, pos(4, 3), HUMAN),
    );
    mediumPlays("no cuelga", board);
    const a = firstMove(search(board));
    expect(a.to.x === 1 && a.to.y === 4).toBe(false);
    expect(a.to.x === 3 && a.to.y === 4).toBe(false);
  });

  it("captura una pieza indefensa", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 5), BOT),
      new GamePiece("w", PieceType.FORT, pos(2, 4), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(0, 8), HUMAN),
      new GamePiece("z", PieceType.PIONEER, pos(4, 1), HUMAN),
    );
    mediumPlays("captura indefensa", board);
    const a = firstMove(search(board));
    expect(a.pieceId).toBe("s");
    expect(a.to.x).toBe(2);
    expect(a.to.y).toBe(4);
  });

  it("anota para ganar con 2 puntos y pieza a 1 de la meta", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(0, 1), BOT),
      new GamePiece("w", PieceType.FORT, pos(4, 8), HUMAN),
    );
    const scores = { [BOT]: 2, [HUMAN]: 0 } as Record<Player, number>;
    mediumPlays("anota para ganar", board, scores);
    const r = search(board, { scores });
    const a = firstMove(r);
    expect(a.pieceId).toBe("s");
    expect(a.to.y).toBe(rules.scoringRow(BOT));
    expect(r.score).toBeGreaterThan(MATE);
  });

  // ── Tácticas profundas (spec items 2–7) ─────────────────────────────

  it("combinación: captura al defensor que tapona la meta y después anota", () => {
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 2), BOT),
      new GamePiece("p", PieceType.FORT, pos(0, 9), BOT),
      new GamePiece("w", PieceType.FORT, pos(2, 1), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(4, 8), HUMAN),
    );
    const scores = { [BOT]: 2, [HUMAN]: 0 } as Record<Player, number>;
    mediumPlays("captura al defensor", board, scores);
    const r = search(board, { scores });
    const a = firstMove(r);
    expect(a.pieceId).toBe("s");
    expect(a.to.x).toBe(2);
    expect(a.to.y).toBe(1);
    expect(r.score).toBeGreaterThan(MATE);
  });

  it("horizonte: no captura lo que se recaptura (SEE < 0)", () => {
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(2, 5), BOT),
      new GamePiece("p", PieceType.PIONEER, pos(4, 7), BOT),
      new GamePiece("s", PieceType.STRIKER, pos(1, 4), HUMAN),
      new GamePiece("d", PieceType.FORT, pos(0, 3), HUMAN),
    );
    mediumPlays("horizonte", board);
    const a = firstMove(search(board));
    expect(a.pieceId === "f" && a.to.x === 1 && a.to.y === 4).toBe(false);
  });

  it("carrera ganada: prioriza el corredor imparable sobre una captura menor", () => {
    // N STRIKER (2,2) corre solo hacia (2,0): nadie lo alcanza. Hay una
    // captura gratis disponible (f→(4,4)) que vale menos que la carrera.
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(2, 2), BOT),
      new GamePiece("f", PieceType.FORT, pos(3, 5), BOT),
      new GamePiece("w", PieceType.FORT, pos(4, 4), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(0, 9), HUMAN),
    );
    mediumPlays("carrera ganada", board);
    const a = firstMove(search(board));
    expect(a.pieceId).toBe("s");
    expect(a.to.y).toBeLessThan(2);
  });

  it("carrera perdida: frena al corredor rival imparable aunque cueste progreso", () => {
    // B STRIKER (2,9) anota el próximo turno en (2,10). La única defensa es
    // capturarlo con el FORT (1,10) — dejar avanzar al propio striker (4,3)
    // perdería la partida (aunque él también progresa).
    const board = boardOf(
      new GamePiece("f", PieceType.FORT, pos(1, 10), BOT),
      new GamePiece("s", PieceType.STRIKER, pos(4, 3), BOT),
      new GamePiece("r", PieceType.STRIKER, pos(2, 9), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(0, 3), HUMAN),
    );
    const scores = { [BOT]: 2, [HUMAN]: 2 } as Record<Player, number>;
    mediumPlays("carrera perdida", board, scores);
    const a = firstMove(search(board, { scores }));
    expect(a.pieceId).toBe("f");
    expect(a.to.x).toBe(2);
    expect(a.to.y).toBe(9);
  });

  it("banca que tapona: baja una pieza al carril del corredor rival", () => {
    // B FORT (2,8) anota en 2 jugadas por la columna 2 y NO captura de
    // frente: un tapón en (2,9) lo enchufa para siempre. Las filas 7–8 están
    // llenas (maxPerRow), así que la única fila de despliegue es la 9; el
    // FORT rival ataca (1,9) y (3,9) — (2,9) queda en el top-K de bajadas.
    const board = boardOf(
      new GamePiece("a", PieceType.FORT, pos(0, 7), BOT),
      new GamePiece("b", PieceType.FORT, pos(1, 7), BOT),
      new GamePiece("c", PieceType.FORT, pos(0, 8), BOT),
      new GamePiece("d", PieceType.FORT, pos(1, 8), BOT),
      new GamePiece("r", PieceType.FORT, pos(2, 8), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(4, 3), HUMAN),
    );
    const opts = {
      scores: { [BOT]: 2, [HUMAN]: 2 } as Record<Player, number>,
      bench: { [BOT]: [PieceType.PIONEER], [HUMAN]: [] } as SimState["bench"],
    };
    mediumPlays("banca que tapona", board, opts.scores);
    const r = search(board, opts);
    expect(r.actions[0]!.kind).toBe("bench");
    if (r.actions[0]!.kind === "bench") {
      expect(r.actions[0]!.to.x).toBe(2);
      expect(r.actions[0]!.to.y).toBe(9);
    }
  });

  it("sacrificio para abrir carril: desvía al defensor que cubre el avance", () => {
    // El corredor N STRIKER (1,7) tiene las 3 casillas de avance cubiertas:
    // B FORT "d" (2,5) cubre (1,6)/(3,6) y B FORT "e" (1,5) cubre (0,6)/(2,6).
    // El FORT N (3,7) se ofrece en (3,6): si B no come, "f" captura "d" y el
    // carril se abre igual; si come, "d" queda en (3,6) y deja de cubrir
    // (1,6) — el corredor avanza y luego se come a "e". 2–2: carril = victoria.
    const board = boardOf(
      new GamePiece("s", PieceType.STRIKER, pos(1, 7), BOT),
      new GamePiece("f", PieceType.FORT, pos(3, 7), BOT),
      new GamePiece("d", PieceType.FORT, pos(2, 5), HUMAN),
      new GamePiece("e", PieceType.FORT, pos(1, 5), HUMAN),
      new GamePiece("y", PieceType.FORT, pos(4, 2), HUMAN),
    );
    const scores = { [BOT]: 2, [HUMAN]: 2 } as Record<Player, number>;
    mediumPlays("sacrificio carril", board, scores);
    const r = search(board, { scores });
    const a = firstMove(r);
    expect(a.pieceId).toBe("f");
    expect(a.to.x).toBe(3);
    expect(a.to.y).toBe(6);
  });
});

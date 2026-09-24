import { beforeEach, describe, expect, it } from "vitest";
import { MovementRuleEngine } from "./MovementRuleEngine";
import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import {
  PieceType,
  Player,
  PIECE_MOVEMENT_CONFIG,
  type PieceMovementConfigMap,
} from "../../domain/constants/PieceConstants";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";

const engine = new MovementRuleEngine();
let board: Board;

const add = (type: PieceType, x: number, y: number, owner: Player): GamePiece => {
  const piece = new GamePiece(`t-${type}-${x}-${y}-${owner}`, type, new Position(x, y), owner);
  board.addPiece(piece);
  return piece;
};

const at = (moves: Position[], x: number, y: number): boolean =>
  moves.some((p) => p.x === x && p.y === y);

beforeEach(() => {
  board = new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
});

describe("FORT", () => {
  it("moves exactly one square forward to an empty tile", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(fort, board);
    expect(moves).toHaveLength(1);
    expect(at(moves, 2, 3)).toBe(true);
  });

  it("cannot move diagonally to an empty tile", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 1, 3)).toBe(false);
    expect(at(moves, 3, 3)).toBe(false);
  });

  it("captures diagonally forward", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    add(PieceType.STRIKER, 3, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 3, 3)).toBe(true);
  });

  it("cannot capture the frontal tile", () => {
    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    add(PieceType.STRIKER, 2, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 2, 3)).toBe(false);
  });
});

describe("STRIKER", () => {
  it("moves to the three forward diagonals and the double step", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 2, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
    expect(at(moves, 2, 4)).toBe(true);
    expect(moves).toHaveLength(4);
  });

  it("loses (2,3) and the double step when an own piece occupies (2,3)", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 2, 3)).toBe(false);
    expect(at(moves, 2, 4)).toBe(false);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
  });

  it("captures only straight ahead", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 1, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 3)).toBe(false);
  });

  it("can capture the frontal enemy", () => {
    const striker = add(PieceType.STRIKER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 2, 3)).toBe(true);
  });
});

describe("PIONEER", () => {
  it("moves 1-3 forward plus one lateral after each forward step", () => {
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(pioneer, board);
    expect(at(moves, 2, 3)).toBe(true);
    expect(at(moves, 2, 4)).toBe(true);
    expect(at(moves, 2, 5)).toBe(true);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 3, 3)).toBe(true);
    expect(at(moves, 1, 4)).toBe(true);
    expect(at(moves, 3, 4)).toBe(true);
    expect(moves).toHaveLength(7);
  });

  it("has no moves when the first forward tile is occupied", () => {
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.BLANCAS);
    expect(engine.getValidMoves(pioneer, board)).toHaveLength(0);
  });

  it("has no moves when the first forward tile holds an enemy (cannot capture)", () => {
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    add(PieceType.FORT, 2, 3, Player.NEGRAS);
    expect(engine.getValidMoves(pioneer, board)).toHaveLength(0);
  });

  it("never lands on an occupied lateral target", () => {
    const pioneer = add(PieceType.PIONEER, 2, 2, Player.BLANCAS);
    add(PieceType.STRIKER, 3, 3, Player.NEGRAS);
    const moves = engine.getValidMoves(pioneer, board);
    expect(at(moves, 3, 3)).toBe(false);
    expect(at(moves, 2, 3)).toBe(true);
  });
});

describe("FORT side-blocking", () => {
  it("blocks the adjacent tiles of an enemy fort", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
    expect(at(moves, 0, 5)).toBe(true);
  });

  it("prevents a striker from capturing inside the blocked zone", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    add(PieceType.PIONEER, 1, 5, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
  });

  it("prevents an allied fort from entering a blocked empty tile", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const fort = add(PieceType.FORT, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 1, 5)).toBe(false);
  });

  it("lets an allied fort bypass the block only by capturing", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const fort = add(PieceType.FORT, 0, 4, Player.BLANCAS);
    add(PieceType.STRIKER, 1, 5, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(at(moves, 1, 5)).toBe(true);
  });

  it("lets pioneer bypass when the blocker is two or more rows ahead", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const pioneer = add(PieceType.PIONEER, 1, 3, Player.BLANCAS);
    const moves = engine.getValidMoves(pioneer, board);
    expect(at(moves, 1, 5)).toBe(true);
  });

  it("blocks pioneer entirely when the blocker is one row ahead", () => {
    add(PieceType.FORT, 2, 4, Player.NEGRAS);
    const pioneer = add(PieceType.PIONEER, 1, 3, Player.BLANCAS);
    expect(engine.getValidMoves(pioneer, board)).toHaveLength(0);
  });

  it("does not block the fort owner's own pieces", () => {
    add(PieceType.FORT, 2, 5, Player.BLANCAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(true);
  });

  it("also blocks the tile beyond when a striker's path crosses a blocked tile", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
    expect(at(moves, 1, 6)).toBe(false);
  });

  it("blocks the striker's double step symmetrically for negras", () => {
    add(PieceType.FORT, 2, 5, Player.BLANCAS);
    const striker = add(PieceType.STRIKER, 1, 6, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
    expect(at(moves, 1, 4)).toBe(false);
  });

  it("still allows the double step when the intermediate tile is not blocked", () => {
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 6)).toBe(true);
  });
});

describe("getBlockedMoves", () => {
  it("reports pattern-reachable tiles made illegal by a blocker", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const blocked = engine.getBlockedMoves(striker, board);
    expect(at(blocked, 1, 5)).toBe(true);
    expect(at(blocked, 0, 5)).toBe(false);
  });

  it("reports the striker's jump destination as blocked when the path crosses a blocked tile", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const blocked = engine.getBlockedMoves(striker, board);
    expect(at(blocked, 1, 5)).toBe(true);
    expect(at(blocked, 1, 6)).toBe(true);
  });

  it("does not throw for a blocked pioneer on the left edge near the try line", () => {
    // Regresión: pioneer NEGRAS en columna 0 con el frente bloqueado —
    // la rama lateral construía Position(-1, y) y lanzaba antes de validar.
    const pioneer = add(PieceType.PIONEER, 0, 1, Player.NEGRAS);
    add(PieceType.FORT, 0, 0, Player.BLANCAS); // bloquea el frente

    let blocked: Position[] = [];
    expect(() => {
      blocked = engine.getBlockedMoves(pioneer, board);
    }).not.toThrow();
    expect(at(blocked, 0, 0)).toBe(true); // frente bloqueado
    expect(at(blocked, 1, 0)).toBe(true); // lateral derecha
    expect(blocked.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
  });
});

describe("board limits", () => {
  it("never generates negative coordinates", () => {
    const striker = add(PieceType.STRIKER, 0, 2, Player.BLANCAS);
    const moves = engine.getValidMoves(striker, board);
    expect(moves.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
    expect(at(moves, 0, 3)).toBe(true);
    expect(at(moves, 1, 3)).toBe(true);
    expect(at(moves, 0, 4)).toBe(true);
    expect(moves).toHaveLength(3);
  });

  it("a blancas piece on the last row has no moves", () => {
    const fort = add(PieceType.FORT, 2, 10, Player.BLANCAS);
    expect(engine.getValidMoves(fort, board)).toHaveLength(0);
  });
});

describe("NEGRAS symmetry", () => {
  it("fort moves one square towards y=0", () => {
    const fort = add(PieceType.FORT, 2, 8, Player.NEGRAS);
    const moves = engine.getValidMoves(fort, board);
    expect(moves).toHaveLength(1);
    expect(at(moves, 2, 7)).toBe(true);
  });

  it("striker mirrors the same fan", () => {
    const striker = add(PieceType.STRIKER, 2, 8, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 7)).toBe(true);
    expect(at(moves, 2, 7)).toBe(true);
    expect(at(moves, 3, 7)).toBe(true);
    expect(at(moves, 2, 6)).toBe(true);
    expect(moves).toHaveLength(4);
  });

  it("a blancas fort blocks sides for negras pieces", () => {
    add(PieceType.FORT, 2, 5, Player.BLANCAS);
    const striker = add(PieceType.STRIKER, 1, 6, Player.NEGRAS);
    const moves = engine.getValidMoves(striker, board);
    expect(at(moves, 1, 5)).toBe(false);
  });
});

describe("getCaptureSquares", () => {
  it("devuelve las diagonales del FORT y el frente del STRIKER", () => {
    const fort = add(PieceType.FORT, 2, 5, Player.BLANCAS);
    const striker = add(PieceType.STRIKER, 0, 3, Player.BLANCAS);
    const pioneer = add(PieceType.PIONEER, 4, 4, Player.BLANCAS);

    const fortSquares = engine.getCaptureSquares(fort, board);
    expect(at(fortSquares, 1, 6)).toBe(true);
    expect(at(fortSquares, 3, 6)).toBe(true);
    expect(fortSquares).toHaveLength(2);

    const strikerSquares = engine.getCaptureSquares(striker, board);
    expect(at(strikerSquares, 0, 4)).toBe(true);
    expect(strikerSquares).toHaveLength(1);

    expect(engine.getCaptureSquares(pioneer, board)).toHaveLength(0);
  });

  it("el bloqueo lateral del FORT tapona capturas del STRIKER pero no las suyas", () => {
    add(PieceType.FORT, 2, 5, Player.NEGRAS);
    const striker = add(PieceType.STRIKER, 1, 4, Player.BLANCAS);
    const fort = add(PieceType.FORT, 0, 4, Player.BLANCAS);

    // (1,5) está en el patrón de captura de ambos pero taponeado para el STRIKER.
    expect(at(engine.getCaptureSquares(striker, board), 1, 5)).toBe(false);
    // El FORT captura ignorando el bloqueo lateral.
    expect(at(engine.getCaptureSquares(fort, board), 1, 5)).toBe(true);
  });
});

describe("config inyectado", () => {
  it("un FORT con captura frontal solo aplica en el motor configurado", () => {
    const customConfig: PieceMovementConfigMap = {
      ...PIECE_MOVEMENT_CONFIG,
      [PieceType.FORT]: {
        ...PIECE_MOVEMENT_CONFIG[PieceType.FORT],
        capture: {
          directions: [
            { dx: 1, dy: 1 },
            { dx: -1, dy: 1 },
            { dx: 0, dy: 1 },
          ],
          minDistance: 1,
          maxDistance: 1,
        },
      },
    };
    const customEngine = new MovementRuleEngine(customConfig);

    const fort = add(PieceType.FORT, 2, 2, Player.BLANCAS);
    add(PieceType.STRIKER, 2, 3, Player.NEGRAS);

    expect(at(customEngine.getValidMoves(fort, board), 2, 3)).toBe(true);
    expect(at(customEngine.getCaptureSquares(fort, board), 2, 3)).toBe(true);
    expect(at(engine.getValidMoves(fort, board), 2, 3)).toBe(false);
  });
});

describe("getCaptureSquares — contrato con getValidMoves", () => {
  const TYPES = [PieceType.FORT, PieceType.STRIKER, PieceType.PIONEER];
  const other = (p: Player) => (p === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS);

  const mulberry32 = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const randomBoard = (rng: () => number): Board => {
    const b = new Board(GAME_CONFIG.BOARD_WIDTH, GAME_CONFIG.BOARD_HEIGHT);
    const count = 8 + Math.floor(rng() * 5);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rng() * GAME_CONFIG.BOARD_WIDTH);
      const y = Math.floor(rng() * GAME_CONFIG.BOARD_HEIGHT);
      if (b.getPieceAt(new Position(x, y))) continue;
      const type = TYPES[Math.floor(rng() * TYPES.length)]!;
      const owner = rng() < 0.5 ? Player.BLANCAS : Player.NEGRAS;
      b.addPiece(new GamePiece(`r-${i}`, type, new Position(x, y), owner));
    }
    return b;
  };

  it("capturas válidas ⊆ captureSquares y toda captureSquare es capturable (200 tableros)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const b = randomBoard(mulberry32(seed));
      for (const piece of b.getAllPieces()) {
        if (!piece.position) continue;
        const captures = engine.getCaptureSquares(piece, b);
        const captureKeys = new Set(captures.map((p) => `${p.x},${p.y}`));

        // (a) todo destino de getValidMoves ocupado por un rival es captureSquare
        for (const to of engine.getValidMoves(piece, b)) {
          const target = b.getPieceAt(to);
          if (target && target.owner !== piece.owner) {
            expect(captureKeys.has(`${to.x},${to.y}`)).toBe(true);
          }
        }

        // (b) cada captureSquare es alcanzable con un rival en la casilla
        for (const sq of captures) {
          const occupant = b.getPieceAt(sq);
          if (occupant && occupant.owner === piece.owner) continue;
          const clone = new Board(b.width, b.height);
          for (const p of b.getAllPieces()) clone.addPiece(p.clone());
          if (!occupant) {
            clone.addPiece(new GamePiece("probe", PieceType.FORT, sq, other(piece.owner)));
          }
          const clonedPiece = clone.getPieceById(piece.id)!;
          const moves = engine.getValidMoves(clonedPiece, clone);
          expect(moves.some((m) => m.equals(sq))).toBe(true);
        }
      }
    }
  });
});

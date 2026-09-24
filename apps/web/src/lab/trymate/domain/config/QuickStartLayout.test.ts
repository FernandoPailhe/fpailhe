import { afterEach, describe, expect, it, vi } from "vitest";
import { Player, PieceType } from "../constants/PieceConstants";
import { GAME_CONFIG } from "../constants/GameConstants";
import { GAME_RULES, GamePhase } from "../constants/GameRules";
import {
  getQuickStartLayout,
  layoutForPlayer,
  QUICK_START_LAYOUTS,
  randomQuickStartLayout,
  resolveQuickStartLayout,
} from "./QuickStartLayout";

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("./quickstart-layouts.json");
  vi.doUnmock("./QuickStartLayout");
  vi.resetModules();
});

describe("QUICK_START_LAYOUTS", () => {
  it("carga los layouts del JSON ya validados al importar el módulo", () => {
    expect(QUICK_START_LAYOUTS.length).toBeGreaterThan(0);
    expect(QUICK_START_LAYOUTS.map((l) => l.id)).toContain("classic");
  });

  it("cada layout respeta las reglas de ejército (5 en tablero, 3 en banca)", () => {
    for (const layout of QUICK_START_LAYOUTS) {
      expect(layout.boardPieces).toHaveLength(GAME_RULES.PIECES_TO_PLACE);
      expect(layout.benchPieces).toHaveLength(GAME_RULES.PIECES_IN_BENCH);
      for (const { position } of layout.boardPieces) {
        expect(GAME_RULES.PLACEMENT_ROWS_PLAYER1).toContain(position.y);
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.x).toBeLessThan(GAME_CONFIG.BOARD_WIDTH);
      }
      const totals = new Map<PieceType, number>();
      for (const type of [...layout.boardPieces.map((p) => p.type), ...layout.benchPieces]) {
        totals.set(type, (totals.get(type) ?? 0) + 1);
      }
      for (const type of Object.values(PieceType)) {
        const count = totals.get(type) ?? 0;
        expect(count).toBeGreaterThanOrEqual(GAME_RULES.MIN_PIECES_PER_TYPE);
        expect(count).toBeLessThanOrEqual(GAME_RULES.MAX_PIECES_PER_TYPE);
      }
    }
  });

  it("al menos 5 layouts son simétricos respecto a la columna central (x → 4−x)", () => {
    const isSymmetric = (layout: (typeof QUICK_START_LAYOUTS)[number]): boolean =>
      layout.boardPieces.every(({ type, position }) =>
        layout.boardPieces.some(
          (other) =>
            other.type === type &&
            other.position.x === GAME_CONFIG.BOARD_WIDTH - 1 - position.x &&
            other.position.y === position.y,
        ),
      );
    const symmetric = QUICK_START_LAYOUTS.filter(isSymmetric);
    expect(symmetric.length).toBeGreaterThanOrEqual(5);
  });

  it("los layouts varían en la distribución de tipos de pieza", () => {
    const signature = (layout: (typeof QUICK_START_LAYOUTS)[number]): string => {
      const totals = new Map<PieceType, number>();
      for (const type of [...layout.boardPieces.map((p) => p.type), ...layout.benchPieces]) {
        totals.set(type, (totals.get(type) ?? 0) + 1);
      }
      return Object.values(PieceType)
        .map((type) => `${type}:${totals.get(type) ?? 0}`)
        .join("|");
    };
    const distinct = new Set(QUICK_START_LAYOUTS.map(signature));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });
});

describe("getQuickStartLayout", () => {
  it("devuelve el layout por id y undefined con uno desconocido", () => {
    expect(getQuickStartLayout("classic")?.id).toBe("classic");
    expect(getQuickStartLayout("no-existe")).toBeUndefined();
  });
});

describe("carga tolerante a reglas", () => {
  it("descarta con warning un layout incompatible con las reglas, sin romper el import", async () => {
    vi.resetModules();
    vi.doMock("./quickstart-layouts.json", () => ({
      default: {
        layouts: [
          {
            id: "fuera-de-filas",
            boardPieces: [
              { type: "FORT", x: 0, y: 5 }, // fila fuera del despliegue
              { type: "FORT", x: 1, y: 1 },
              { type: "STRIKER", x: 2, y: 1 },
              { type: "PIONEER", x: 3, y: 1 },
              { type: "PIONEER", x: 4, y: 1 },
            ],
            benchPieces: ["FORT", "STRIKER", "STRIKER"],
          },
          {
            id: "ok",
            boardPieces: [
              { type: "FORT", x: 0, y: 1 },
              { type: "STRIKER", x: 1, y: 1 },
              { type: "PIONEER", x: 0, y: 2 },
              { type: "FORT", x: 1, y: 2 },
              { type: "STRIKER", x: 0, y: 3 },
            ],
            benchPieces: ["STRIKER", "PIONEER", "PIONEER"],
          },
        ],
      },
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("./QuickStartLayout");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"fuera-de-filas" descartado'));
    expect(mod.QUICK_START_LAYOUTS.map((l) => l.id)).toEqual(["ok"]);
    expect(mod.hasQuickStartLayouts()).toBe(true);
  });

  it("sigue lanzando con errores estructurales (tipo inexistente)", async () => {
    vi.resetModules();
    vi.doMock("./quickstart-layouts.json", () => ({
      default: {
        layouts: [
          {
            id: "roto",
            boardPieces: [{ type: "DRAGON", x: 0, y: 1 }],
            benchPieces: [],
          },
        ],
      },
    }));
    await expect(import("./QuickStartLayout")).rejects.toThrow(/tipo de pieza inválido/);
  });

  it("quickStart sin layouts válidos cae a ejército generado (5+3 por jugador)", async () => {
    vi.resetModules();
    vi.doMock("./QuickStartLayout", () => ({
      QUICK_START_LAYOUTS: [],
      hasQuickStartLayouts: () => false,
      getQuickStartLayout: () => undefined,
      randomQuickStartLayout: () => undefined,
      layoutForPlayer: (l: unknown) => l,
      resolveQuickStartLayout: () => undefined,
    }));
    const { createGameStore } = await import("../../application/GameState");
    const store = createGameStore();
    store.getState().quickStart();
    const s = store.getState();
    expect(s.gamePhase).toBe(GamePhase.PLAYING);
    expect(s.board.getAllPieces()).toHaveLength(10);
    expect(s.player1State.getBenchPieces()).toHaveLength(3);
    expect(s.player2State.getBenchPieces()).toHaveLength(3);
  });
});

describe("layoutForPlayer", () => {
  it("deja intactas las posiciones para BLANCAS", () => {
    const layout = getQuickStartLayout("classic")!;
    expect(layoutForPlayer(layout, Player.BLANCAS)).toBe(layout);
  });

  it("espeja las filas para NEGRAS conservando las columnas", () => {
    const layout = getQuickStartLayout("classic")!;
    const mirrored = layoutForPlayer(layout, Player.NEGRAS);
    const mirrorY = (y: number) => GAME_CONFIG.BOARD_HEIGHT - 1 - y;

    expect(mirrored.boardPieces).toHaveLength(layout.boardPieces.length);
    layout.boardPieces.forEach(({ type, position }, i) => {
      const mirroredPiece = mirrored.boardPieces[i]!;
      expect(mirroredPiece.type).toBe(type);
      expect(mirroredPiece.position.x).toBe(position.x);
      expect(mirroredPiece.position.y).toBe(mirrorY(position.y));
      expect(GAME_RULES.PLACEMENT_ROWS_PLAYER2).toContain(mirroredPiece.position.y);
    });
    expect(mirrored.benchPieces).toEqual(layout.benchPieces);
  });
});

describe("randomQuickStartLayout", () => {
  it("usa el rng inyectado para elegir el índice", () => {
    expect(randomQuickStartLayout(() => 0)).toBe(QUICK_START_LAYOUTS[0]);
    const last = QUICK_START_LAYOUTS[QUICK_START_LAYOUTS.length - 1]!;
    expect(randomQuickStartLayout(() => 0.999)).toBe(last);
  });
});

describe("resolveQuickStartLayout", () => {
  it("con id explícito devuelve ese layout orientado al jugador", () => {
    const forBlack = resolveQuickStartLayout(Player.NEGRAS, "classic")!;
    const pioneer = forBlack.boardPieces.find((p) => p.type === PieceType.PIONEER);
    expect(pioneer?.position.x).toBe(2);
    expect(pioneer?.position.y).toBe(8);
  });

  it("sin id sortea un layout válido para el equipo; id inexistente da undefined", () => {
    const layout = resolveQuickStartLayout(Player.NEGRAS)!;
    for (const { position } of layout.boardPieces) {
      expect(GAME_RULES.PLACEMENT_ROWS_PLAYER2).toContain(position.y);
    }
    expect(resolveQuickStartLayout(Player.NEGRAS, "no-existe")).toBeUndefined();
  });
});

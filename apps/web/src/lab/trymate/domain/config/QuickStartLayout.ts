import { GAME_CONFIG } from "../constants/GameConstants";
import { GAME_RULES } from "../constants/GameRules";
import { PieceType, Player } from "../constants/PieceConstants";
import { Position } from "../entities/Position";
import rawConfig from "./quickstart-layouts.json";

interface RawLayoutPiece {
  type: string;
  x: number;
  y: number;
}

interface RawLayout {
  id: string;
  name?: string;
  boardPieces: RawLayoutPiece[];
  benchPieces: string[];
}

export interface QuickStartLayoutPiece {
  type: PieceType;
  position: Position;
}

/**
 * Layout de quick start ya parseado y validado. Las posiciones siempre se
 * expresan desde la perspectiva de BLANCAS (filas PLACEMENT_ROWS_PLAYER1);
 * `layoutForPlayer` las espeja para NEGRAS.
 */
export interface QuickStartLayout {
  id: string;
  name: string;
  boardPieces: QuickStartLayoutPiece[];
  benchPieces: PieceType[];
}

/** Selección opcional de layout por equipo; ausente = sorteo al azar. */
export interface QuickStartLayoutSelection {
  player1?: string;
  player2?: string;
}

const VALID_TYPES = new Set<string>(Object.values(PieceType));

function parseType(layoutId: string, raw: string): PieceType {
  if (!VALID_TYPES.has(raw)) {
    throw new Error(`quickstart-layouts: "${layoutId}" tiene tipo de pieza inválido "${raw}"`);
  }
  return raw as PieceType;
}

function parseLayout(raw: RawLayout): QuickStartLayout {
  const id = raw.id?.trim();
  if (!id) {
    throw new Error("quickstart-layouts: layout sin id");
  }
  if (raw.boardPieces.length !== GAME_RULES.PIECES_TO_PLACE) {
    throw new Error(
      `quickstart-layouts: "${id}" tiene ${raw.boardPieces.length} piezas en tablero, ` +
        `esperadas ${GAME_RULES.PIECES_TO_PLACE}`,
    );
  }
  if (raw.benchPieces.length !== GAME_RULES.PIECES_IN_BENCH) {
    throw new Error(
      `quickstart-layouts: "${id}" tiene ${raw.benchPieces.length} piezas en banca, ` +
        `esperadas ${GAME_RULES.PIECES_IN_BENCH}`,
    );
  }

  const occupied = new Set<string>();
  const rowCount = new Map<number, number>();
  const boardPieces = raw.boardPieces.map(({ type, x, y }) => {
    const pieceType = parseType(id, type);
    if (x < 0 || x >= GAME_CONFIG.BOARD_WIDTH) {
      throw new Error(`quickstart-layouts: "${id}" tiene x=${x} fuera del tablero`);
    }
    if (!(GAME_RULES.PLACEMENT_ROWS_PLAYER1 as readonly number[]).includes(y)) {
      throw new Error(
        `quickstart-layouts: "${id}" coloca una pieza en y=${y}, fuera de ` +
          `las filas de despliegue ${GAME_RULES.PLACEMENT_ROWS_PLAYER1}`,
      );
    }
    const key = `${x},${y}`;
    if (occupied.has(key)) {
      throw new Error(`quickstart-layouts: "${id}" tiene dos piezas en ${key}`);
    }
    occupied.add(key);
    const inRow = (rowCount.get(y) ?? 0) + 1;
    rowCount.set(y, inRow);
    if (inRow > GAME_RULES.MAX_PIECES_PER_ROW) {
      throw new Error(`quickstart-layouts: "${id}" supera MAX_PIECES_PER_ROW en la fila ${y}`);
    }
    return { type: pieceType, position: new Position(x, y) };
  });

  const benchPieces = raw.benchPieces.map((type) => parseType(id, type));

  const totals = new Map<PieceType, number>();
  for (const type of [...boardPieces.map((p) => p.type), ...benchPieces]) {
    totals.set(type, (totals.get(type) ?? 0) + 1);
  }
  for (const type of Object.values(PieceType)) {
    const count = totals.get(type) ?? 0;
    if (count < GAME_RULES.MIN_PIECES_PER_TYPE || count > GAME_RULES.MAX_PIECES_PER_TYPE) {
      throw new Error(
        `quickstart-layouts: "${id}" tiene ${count} piezas ${type}, fuera de ` +
          `[${GAME_RULES.MIN_PIECES_PER_TYPE}, ${GAME_RULES.MAX_PIECES_PER_TYPE}]`,
      );
    }
  }

  return { id, name: raw.name ?? id, boardPieces, benchPieces };
}

function parseLayouts(raw: RawLayout[]): QuickStartLayout[] {
  const ids = new Set<string>();
  return raw.map((layout) => {
    const parsed = parseLayout(layout);
    if (ids.has(parsed.id)) {
      throw new Error(`quickstart-layouts: id duplicado "${parsed.id}"`);
    }
    ids.add(parsed.id);
    return parsed;
  });
}

/**
 * Layouts disponibles, validados al cargar el módulo: un JSON inválido
 * rompe el build/tests en vez de fallar en runtime.
 */
export const QUICK_START_LAYOUTS: readonly QuickStartLayout[] = parseLayouts(
  rawConfig.layouts as RawLayout[],
);

export function getQuickStartLayout(id: string): QuickStartLayout {
  const layout = QUICK_START_LAYOUTS.find((l) => l.id === id);
  if (!layout) {
    throw new Error(`quickstart-layouts: layout desconocido "${id}"`);
  }
  return layout;
}

export function randomQuickStartLayout(rng: () => number = Math.random): QuickStartLayout {
  const layout = QUICK_START_LAYOUTS[Math.floor(rng() * QUICK_START_LAYOUTS.length)];
  if (!layout) {
    throw new Error("quickstart-layouts: no hay layouts configurados");
  }
  return layout;
}

/**
 * Devuelve el layout desde la perspectiva del jugador: NEGRAS espeja las
 * filas (y → BOARD_HEIGHT - 1 - y), igual que el setup simétrico original.
 */
export function layoutForPlayer(layout: QuickStartLayout, player: Player): QuickStartLayout {
  if (player === Player.BLANCAS) return layout;
  return {
    ...layout,
    boardPieces: layout.boardPieces.map(({ type, position }) => ({
      type,
      position: new Position(position.x, GAME_CONFIG.BOARD_HEIGHT - 1 - position.y),
    })),
  };
}

/** Resuelve el layout de un equipo: `layoutId` explícito o sorteo al azar. */
export function resolveQuickStartLayout(player: Player, layoutId?: string): QuickStartLayout {
  const layout = layoutId ? getQuickStartLayout(layoutId) : randomQuickStartLayout();
  return layoutForPlayer(layout, player);
}

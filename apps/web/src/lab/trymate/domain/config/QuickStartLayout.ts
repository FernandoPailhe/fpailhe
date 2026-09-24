import { PieceType, Player } from "../constants/PieceConstants";
import { Position } from "../entities/Position";
import { CURRENT_RULES } from "./RulesView";
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
 * expresan desde la perspectiva de BLANCAS (sus filas de despliegue);
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

/**
 * Parsea la estructura del layout (id, tipos, posiciones). Errores
 * estructurales — tipo inexistente, id vacío — lanzan: el JSON está roto.
 * El cumplimiento de las reglas de ejército se valida aparte
 * (`rulesViolation`) porque un layout incompatible con las reglas vigentes
 * se descarta, no rompe el módulo.
 */
function parseLayout(raw: RawLayout): QuickStartLayout {
  const id = raw.id?.trim();
  if (!id) {
    throw new Error("quickstart-layouts: layout sin id");
  }
  const boardPieces = raw.boardPieces.map(({ type, x, y }) => ({
    type: parseType(id, type),
    position: new Position(x, y),
  }));
  const benchPieces = raw.benchPieces.map((type) => parseType(id, type));
  return { id, name: raw.name ?? id, boardPieces, benchPieces };
}

/** Motivo por el que el layout viola las reglas vigentes, o null si cumple. */
function rulesViolation(layout: QuickStartLayout): string | null {
  const rules = CURRENT_RULES;
  const { boardPieces, benchPieces } = layout;

  if (boardPieces.length !== rules.piecesToPlace) {
    return `tiene ${boardPieces.length} piezas en tablero, esperadas ${rules.piecesToPlace}`;
  }
  if (benchPieces.length !== rules.benchSize) {
    return `tiene ${benchPieces.length} piezas en banca, esperadas ${rules.benchSize}`;
  }

  const placementRows = rules.placementRows(Player.BLANCAS);
  const occupied = new Set<string>();
  const rowCount = new Map<number, number>();
  for (const { position } of boardPieces) {
    const { x, y } = position;
    if (x >= rules.width) {
      return `tiene x=${x} fuera del tablero de ${rules.width} columnas`;
    }
    if (!placementRows.includes(y)) {
      return `coloca una pieza en y=${y}, fuera de las filas de despliegue ${placementRows}`;
    }
    const key = `${x},${y}`;
    if (occupied.has(key)) {
      return `tiene dos piezas en ${key}`;
    }
    occupied.add(key);
    const inRow = (rowCount.get(y) ?? 0) + 1;
    rowCount.set(y, inRow);
    if (inRow > rules.maxPerRow) {
      return `supera el máximo de ${rules.maxPerRow} piezas por fila en la fila ${y}`;
    }
  }

  const totals = new Map<PieceType, number>();
  for (const type of [...boardPieces.map((p) => p.type), ...benchPieces]) {
    totals.set(type, (totals.get(type) ?? 0) + 1);
  }
  for (const type of rules.pieceTypes) {
    const count = totals.get(type) ?? 0;
    if (count < rules.minPerType || count > rules.maxPerType) {
      return `tiene ${count} piezas ${type}, fuera de [${rules.minPerType}, ${rules.maxPerType}]`;
    }
  }
  return null;
}

function parseLayouts(raw: RawLayout[]): QuickStartLayout[] {
  const ids = new Set<string>();
  const valid: QuickStartLayout[] = [];
  for (const layout of raw) {
    // parseLayout lanza solo por errores estructurales (JSON roto).
    const parsed = parseLayout(layout);
    if (ids.has(parsed.id)) {
      throw new Error(`quickstart-layouts: id duplicado "${parsed.id}"`);
    }
    ids.add(parsed.id);
    const violation = rulesViolation(parsed);
    if (violation) {
      console.warn(`quickstart-layouts: "${parsed.id}" descartado: ${violation}`);
      continue;
    }
    valid.push(parsed);
  }
  return valid;
}

/**
 * Layouts disponibles, validados al cargar el módulo. Un JSON estructuralmente
 * roto sigue lanzando; un layout incompatible con las reglas vigentes se
 * descarta con un warning y quick start cae a un ejército generado.
 */
export const QUICK_START_LAYOUTS: readonly QuickStartLayout[] = parseLayouts(
  rawConfig.layouts as RawLayout[],
);

/** True si quedó al menos un layout compatible con las reglas vigentes. */
export function hasQuickStartLayouts(): boolean {
  return QUICK_START_LAYOUTS.length > 0;
}

export function getQuickStartLayout(id: string): QuickStartLayout | undefined {
  return QUICK_START_LAYOUTS.find((l) => l.id === id);
}

export function randomQuickStartLayout(
  rng: () => number = Math.random,
): QuickStartLayout | undefined {
  return QUICK_START_LAYOUTS[Math.floor(rng() * QUICK_START_LAYOUTS.length)];
}

/**
 * Devuelve el layout desde la perspectiva del jugador: NEGRAS espeja las
 * filas (y → height − 1 − y), igual que el setup simétrico original.
 */
export function layoutForPlayer(layout: QuickStartLayout, player: Player): QuickStartLayout {
  if (player === Player.BLANCAS) return layout;
  return {
    ...layout,
    boardPieces: layout.boardPieces.map(({ type, position }) => ({
      type,
      position: new Position(position.x, CURRENT_RULES.height - 1 - position.y),
    })),
  };
}

/**
 * Resuelve el layout de un equipo: `layoutId` explícito o sorteo al azar.
 * Devuelve undefined si no hay layouts válidos o el id no existe — el
 * llamador decide el fallback (ejército generado).
 */
export function resolveQuickStartLayout(
  player: Player,
  layoutId?: string,
  rng: () => number = Math.random,
): QuickStartLayout | undefined {
  const layout = layoutId ? getQuickStartLayout(layoutId) : randomQuickStartLayout(rng);
  return layout ? layoutForPlayer(layout, player) : undefined;
}

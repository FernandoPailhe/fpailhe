import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import type { RulesView } from "../../domain/config/RulesView";
import type { SimState } from "../../application/ai/sim/SimState";

/**
 * Codificación compacta de una posición, independiente del tamaño del tablero
 * y de los tipos de pieza (los tipos se referencian por índice en
 * `rules.pieceTypes`, en base 36 — no por nombre).
 *
 * Formato: `"<current>|<scoreB>,<scoreN>|<benchB>|<benchN>|<pieces>"`
 * - `current`: "b" | "n"
 * - `bench*`: índices de tipo concatenados (ej. "012"); vacío = ""
 * - `pieces`: `"<T><o><x>.<y>"` separadas por ";" — T = índice del tipo
 *   (base 36), o = b|n. Ordenadas por (y, x) para round-trip idéntico.
 */
const ownerChar = (p: Player): string => (p === Player.BLANCAS ? "b" : "n");
const fromChar = (c: string): Player => (c === "b" ? Player.BLANCAS : Player.NEGRAS);

export function encodePosition(sim: SimState): string {
  const typeIndex = (t: PieceType): number => sim.rules.pieceTypes.indexOf(t);
  const benchCode = (p: Player): string =>
    sim.bench[p].map((t) => typeIndex(t).toString(36)).join("");
  const pieces = sim.board
    .getAllPieces()
    .filter((p) => p.position !== null)
    .sort((a, b) => a.position!.y - b.position!.y || a.position!.x - b.position!.x)
    .map(
      (p) =>
        `${typeIndex(p.type).toString(36)}${ownerChar(p.owner)}${p.position!.x}.${p.position!.y}`,
    )
    .join(";");
  return [
    ownerChar(sim.current),
    `${sim.scores[Player.BLANCAS]},${sim.scores[Player.NEGRAS]}`,
    benchCode(Player.BLANCAS),
    benchCode(Player.NEGRAS),
    pieces,
  ].join("|");
}

const PIECE_RE = /^([0-9a-z]+)([bn])(\d+)\.(\d+)$/;

/** Decodifica a SimState con ids sintéticos "p<i>" (orden de lectura). */
export function decodePosition(code: string, rules: RulesView): SimState {
  const parts = code.split("|");
  if (parts.length !== 5) {
    throw new Error(`decodePosition: formato inválido (se esperaban 5 secciones): "${code}"`);
  }
  const [cur, scoresPart, benchB, benchN, piecesPart] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (cur !== "b" && cur !== "n") throw new Error(`decodePosition: current inválido "${cur}"`);

  const scoreMatch = /^(\d+),(\d+)$/.exec(scoresPart);
  if (!scoreMatch) throw new Error(`decodePosition: scores inválidos "${scoresPart}"`);
  const scores = {
    [Player.BLANCAS]: Number(scoreMatch[1]),
    [Player.NEGRAS]: Number(scoreMatch[2]),
  } as Record<Player, number>;

  const benchOf = (s: string): PieceType[] =>
    [...s].map((ch) => {
      const idx = parseInt(ch, 36);
      const t = rules.pieceTypes[idx];
      if (t === undefined) throw new Error(`decodePosition: tipo de banca fuera de rango "${ch}"`);
      return t;
    });

  const board = new Board(rules.width, rules.height);
  if (piecesPart !== "") {
    for (const [i, tok] of piecesPart.split(";").entries()) {
      const m = PIECE_RE.exec(tok);
      if (!m) throw new Error(`decodePosition: pieza inválida "${tok}"`);
      const type = rules.pieceTypes[parseInt(m[1]!, 36)];
      if (type === undefined) throw new Error(`decodePosition: tipo fuera de rango "${m[1]}"`);
      const x = Number(m[3]);
      const y = Number(m[4]);
      if (x < 0 || x >= rules.width || y < 0 || y >= rules.height) {
        throw new Error(`decodePosition: (${x},${y}) fuera del tablero`);
      }
      board.addPiece(new GamePiece(`p${i}`, type, new Position(x, y), fromChar(m[2]!)));
    }
  }

  return {
    rules,
    board,
    current: fromChar(cur),
    scores,
    bench: { [Player.BLANCAS]: benchOf(benchB), [Player.NEGRAS]: benchOf(benchN) },
    winner: null,
  };
}

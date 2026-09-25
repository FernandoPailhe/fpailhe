import type { Board } from "../../../domain/entities/Board";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import type { RulesView } from "../../../domain/config/RulesView";
import { rulesFingerprint } from "../../../domain/config/RulesView";
import { createSeededRng } from "../rng";

/** Hash de 64 bits como dos uint32 (evita BigInt por rendimiento). */
export interface ZobristHash {
  hi: number;
  lo: number;
}

export interface ZobristKeys {
  piece(type: PieceType, owner: Player, x: number, y: number): ZobristHash;
  /** Se aplica cuando `current === NEGRAS` (se conmuta en cada cambio de turno). */
  side: ZobristHash;
  bench(owner: Player, type: PieceType, count: number): ZobristHash;
  score(owner: Player, pts: number): ZobristHash;
}

export const xorHash = (a: ZobristHash, b: ZobristHash): ZobristHash => ({
  hi: (a.hi ^ b.hi) >>> 0,
  lo: (a.lo ^ b.lo) >>> 0,
});

export const hashKey = (h: ZobristHash): string => `${h.hi}:${h.lo}`;

const nextU32 = (rng: () => number): number => Math.floor(rng() * 0x1_0000_0000) >>> 0;
const nextHash = (rng: () => number): ZobristHash => ({ hi: nextU32(rng), lo: nextU32(rng) });

const cache = new Map<string, ZobristKeys>();

/**
 * Genera claves Zobrist para `width × height × pieceTypes × jugadores`, turno,
 * conteos de banca (0..benchSize) y puntajes (0..pointsToWin). Todo derivado
 * de `rules` — nada fijo. Memoizado por fingerprint + seed.
 */
export function createZobristKeys(rules: RulesView, seed = 1): ZobristKeys {
  const memoKey = `${rulesFingerprint(rules, null)}|${seed}`;
  const hit = cache.get(memoKey);
  if (hit) return hit;

  const rng = createSeededRng(seed);
  const players = [Player.BLANCAS, Player.NEGRAS];
  const pieceKeys = new Map<string, ZobristHash>();
  for (const type of rules.pieceTypes) {
    for (const owner of players) {
      for (let y = 0; y < rules.height; y++) {
        for (let x = 0; x < rules.width; x++) {
          pieceKeys.set(`${type}|${owner}|${x}|${y}`, nextHash(rng));
        }
      }
    }
  }
  const side = nextHash(rng);
  const benchKeys = new Map<string, ZobristHash>();
  for (const owner of players) {
    for (const type of rules.pieceTypes) {
      for (let count = 0; count <= rules.benchSize; count++) {
        benchKeys.set(`${owner}|${type}|${count}`, nextHash(rng));
      }
    }
  }
  const scoreKeys = new Map<string, ZobristHash>();
  for (const owner of players) {
    for (let pts = 0; pts <= rules.pointsToWin; pts++) {
      scoreKeys.set(`${owner}|${pts}`, nextHash(rng));
    }
  }

  const keys: ZobristKeys = {
    piece: (type, owner, x, y) => pieceKeys.get(`${type}|${owner}|${x}|${y}`)!,
    side,
    bench: (owner, type, count) => benchKeys.get(`${owner}|${type}|${count}`)!,
    score: (owner, pts) => scoreKeys.get(`${owner}|${pts}`)!,
  };
  cache.set(memoKey, keys);
  return keys;
}

/** Hash completo desde cero (construcción y verificación del incremental). */
export function fullHash(
  state: {
    board: Board;
    current: Player;
    scores: Record<Player, number>;
    bench: Record<Player, PieceType[]>;
  },
  rules: RulesView,
  keys: ZobristKeys,
): ZobristHash {
  let h: ZobristHash = { hi: 0, lo: 0 };
  for (const piece of state.board.getAllPieces()) {
    if (!piece.position) continue;
    h = xorHash(h, keys.piece(piece.type, piece.owner, piece.position.x, piece.position.y));
  }
  for (const owner of [Player.BLANCAS, Player.NEGRAS]) {
    // Una clave por (dueño, tipo): la del conteo actual, incluido 0.
    for (const type of rules.pieceTypes) {
      const count = state.bench[owner].filter((t) => t === type).length;
      h = xorHash(h, keys.bench(owner, type, count));
    }
    h = xorHash(h, keys.score(owner, state.scores[owner]));
  }
  if (state.current === Player.NEGRAS) h = xorHash(h, keys.side);
  return h;
}

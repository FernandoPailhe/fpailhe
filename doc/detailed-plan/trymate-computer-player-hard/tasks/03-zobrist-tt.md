# Task 03: Hash Zobrist y tabla de transposición

> Parte del plan: `../plan.md` — ver "Búsqueda Hard" (TT) y "Supuestos" (clave de 2×32 bits).

## Skill / Capa

Application pura (`application/ai/hard/`).

## Objetivo

Reconocer posiciones repetidas por distintos órdenes de jugadas y reusar resultados.

## Depende De

- Task 02.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/zobrist.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/transposition.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/SearchBoard.ts` — editar (hash incremental).
- Tests de ambos.

## Detalles de Implementación

```ts
export interface ZobristHash {
  hi: number;
  lo: number;
} // dos uint32
export interface ZobristKeys {
  piece(type: PieceType, owner: Player, x: number, y: number): ZobristHash;
  side: ZobristHash;
  bench(owner: Player, type: PieceType, count: number): ZobristHash;
  score(owner: Player, pts: number): ZobristHash;
}
export function createZobristKeys(rules: RulesView, seed?: number): ZobristKeys; // memo por rulesFingerprint
export const xorHash: (a: ZobristHash, b: ZobristHash) => ZobristHash;
export const hashKey: (h: ZobristHash) => string; // `${hi}:${lo}`
```

- Claves generadas con `createSeededRng` para `width × height × pieceTypes × {BLANCAS, NEGRAS}`,
  más turno, conteos de banca (0..`benchSize`) y puntos (0..`pointsToWin`). Nada fijo.
- `SearchBoard`: calcular hash completo al construir; actualizar con XOR en `make`/`unmake`
  (pieza sale/entra de casilla, captura, anotación, banca, turno).

```ts
export const enum Bound {
  Exact = 0,
  Lower = 1,
  Upper = 2,
}
export interface TTEntry {
  depth: number;
  score: number;
  bound: Bound;
  best: HardAction | null;
}
export class TranspositionTable {
  constructor(maxEntries = 200_000);
  get(h: ZobristHash): TTEntry | undefined;
  set(h: ZobristHash, e: TTEntry): void; // reemplazar si e.depth ≥ actual.depth; si lleno, borrar el más viejo (Map mantiene orden de inserción)
  clear(): void;
}
```

- Puntajes de victoria en TT: ajustar por distancia a la raíz al guardar/leer (convención
  estándar "mate score") para no mezclar profundidades.

## Fuera de Alcance

- Usar la TT en la búsqueda (Task 06).

## Verificación

- [ ] Hash incremental == hash recalculado desde cero tras 1 000 make/unmake aleatorios.
- [ ] Dos órdenes distintos que llegan a la misma posición → mismo hash.
- [ ] Colisiones: 50 000 posiciones aleatorias distintas → 0 colisiones de 64 bits.
- [ ] TT respeta `maxEntries` y la política de reemplazo.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard` + `pnpm typecheck`

## Handoff

- Produce: `ZobristHash`, `SearchBoard.hash` incremental, `TranspositionTable`.

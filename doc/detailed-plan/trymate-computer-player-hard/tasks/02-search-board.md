# Task 02: `SearchBoard` con make/unmake

> Parte del plan: `../plan.md` — ver "Arquitectura" y "Contratos compartidos" (`HardAction`).

## Skill / Capa

Application pura (`application/ai/hard/`).

## Objetivo

Un estado de búsqueda mutable que aplica y deshace acciones sin clonar el tablero en cada
nodo, con reglas inyectadas. Es la base de rendimiento para buscar a 4–6 plies.

## Depende De

- Task 01. Del plan Easy agnóstico: `RulesView`, motor, `SimState` (para tests de paridad).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/SearchBoard.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/SearchBoard.test.ts` — crear.

## Detalles de Implementación

```ts
export interface Undo {
  /* datos para revertir: pieza movida y su from, capturada (pieza completa), si anotó, bench quitado, hash previo, current previo, winner previo */
}
export class SearchBoard {
  constructor(sim: SimState, engine: MovementRuleEngine);
  readonly rules: RulesView;
  readonly board: Board;
  readonly engine: MovementRuleEngine;
  current: Player;
  scores: Record<Player, number>;
  bench: Record<Player, PieceType[]>;
  winner: Player | null;
  hash: ZobristHash;
  piecesOnBoard: Record<Player, number>;
  generateMoves(): HardAction[]; // solo "move"
  generateBenchDrops(): HardAction[]; // "bench" válidas (tipos distintos × casillas); [] si no puede
  make(a: HardAction): Undo; // move: cambia turno; bench: NO cambia turno
  unmake(u: Undo): void;
  toSimState(): SimState; // para evaluación/tests
}
```

- `board` es un **clon** propio (`cloneBoard`), nunca el del store.
- `make(move)`: `board.movePiece` (remueve capturada; guardarla en `Undo` para reinsertarla con
  `addPiece`); si llega a `rules.scoringRow(current)` → `removePiece` y `scores[current]++`;
  `winner` si `≥ rules.pointsToWin`; `current = opponentOf(current)`.
- `make(bench)`: validar con `getBenchPlacementSquares(board, current, rules)` y
  `piecesOnBoard[current] < rules.piecesToPlace`; crear pieza con id `sb-bench-<n>` (contador
  interno); quitar un `type` de `bench[current]`.
- `unmake` restaura exactamente (incluido el orden de `bench`).
- `hash`: por ahora un número `0`; Task 03 lo vuelve Zobrist incremental (dejar los puntos de
  actualización marcados con `// zobrist:`).
- Sin literales de reglas (lint del plan Easy agnóstico).

## Fuera de Alcance

- Hash real y TT (Task 03). Evaluación (Task 04).

## Verificación

- [ ] Paridad: 500 secuencias aleatorias sembradas de make → estado idéntico a aplicar lo mismo
      con `applySimMove`/`applySimBench` (piezas, puntajes, banca, winner, current).
- [ ] make + unmake × N vuelve al estado inicial exacto (comparar serialización).
- [ ] Variante 7×13 y `altered-moves`: igual de consistente.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard` + `pnpm typecheck`

## Handoff

- Produce: `SearchBoard`, `Undo` para Tasks 03–06.

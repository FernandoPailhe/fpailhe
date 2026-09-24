# Task 03: Estado de simulación con reglas inyectadas (`SimState`)

> **Si `trymate-rules-agnostic-easy` está implementado:** cubierta por su Task 08. Solo verificar y agregar `simFromContext` si falta.

> Parte del plan: `../plan.md` — ver "Arquitectura de la IA".

## Skill / Capa

Application pura (`application/ai/sim/`).

## Objetivo

Simular jugadas y bajadas de banca sin tocar el store, con las reglas recibidas por parámetro,
para que la búsqueda y la arena de variantes funcionen con cualquier `RulesView`.

## Depende De

- Task 02: `RulesView`, `turnRules` con `rules`, motor configurable.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/sim/SimState.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/sim/SimState.test.ts` — crear.

## Detalles de Implementación

```ts
export interface SimState {
  rules: RulesView;
  board: Board;
  current: Player;
  scores: Record<Player, number>;
  bench: Record<Player, PieceType[]>;
  winner: Player | null;
}
export interface SimMove { pieceId: string; from: Position; to: Position; capture?: PieceType; scores: boolean }

export const opponentOf = (p: Player): Player;
export function cloneBoard(board: Board): Board;
export function simFromContext(ctx: BotContext): SimState;               // current = ctx.bot
export function generateMoves(state: SimState, engine: MovementRuleEngine): SimMove[];
export function applySimMove(state: SimState, move: SimMove): SimState;  // no muta
export function applySimBench(state: SimState, type: PieceType, to: Position, id: string): SimState; // no cambia turno
export function passTurn(state: SimState): SimState;
```

- `cloneBoard`: `new Board(board.width, board.height)` + `addPiece(piece.clone())`.
- `generateMoves`: `scores = to.y === state.rules.scoringRow(current)`.
- `applySimMove`: `movePiece` (remueve capturada); si `scores` → `removePiece` y +1;
  `winner` si `scores[current] ≥ rules.pointsToWin`; alterna `current`.
- `applySimBench`: valida con `getBenchPlacementSquares(board, current, rules)` y
  `canPlaceFromBench(...)` (lanza si es inválido: la arena lo usa como árbitro), agrega
  `new GamePiece(id, type, to, current)`, quita un `type` de `bench[current]`.
- Ningún literal de tamaño/filas: todo desde `state.rules` o `board.width/height`.

## Fuera de Alcance

- No evaluar ni buscar.

## Verificación

- [ ] Paridad con el store (reglas actuales): desde `quickStart()` 6 movimientos por store y por
      `applySimMove` dan mismas piezas y puntajes.
- [ ] Con un `RulesView` de 7×13 y `pointsToWin: 2`: anotar en fila 12 suma y el segundo punto da `winner`.
- [ ] `applySimBench` lanza fuera de las filas de despliegue o con ≥ `piecesToPlace` en tablero.
- [ ] No muta estado de entrada.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/sim` + `pnpm typecheck`

## Handoff

- Produce: `SimState`, `SimMove`, `cloneBoard`, `simFromContext`, `generateMoves`,
  `applySimMove`, `applySimBench`, `passTurn`, `opponentOf`.

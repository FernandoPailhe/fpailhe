# Task 02: Helpers puros de turno (`turnRules.ts`)

> Parte del plan: `../plan.md` — ver "Lógica Derivada".

## Skill / Capa

Seguir `.devin/skills/rugby-chess-state/SKILL.md` (aplicar sobre `apps/web/src/lab/trymate/`)
y `.devin/rules/rules.md`.

## Objetivo

Crear funciones puras de consulta de turno, sin gating de "jugador local", y usarlas para
eliminar el cálculo triplicado de casillas de despliegue en `GameState.ts`.

## Depende De

- Nada.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/rules/turnRules.ts` — crear.
- `apps/web/src/lab/trymate/application/rules/turnRules.test.ts` — crear.
- `apps/web/src/lab/trymate/application/GameState.ts` — editar (refactor, sin cambio de comportamiento).

## Detalles de Implementación

```ts
import { Board } from "../../domain/entities/Board";
import { Position } from "../../domain/entities/Position";
import { PlayerState } from "../../domain/entities/PlayerState";
import { Player } from "../../domain/constants/PieceConstants";
import { GAME_RULES } from "../../domain/constants/GameRules";
import { GAME_CONFIG } from "../../domain/constants/GameConstants";
import { MovementRuleEngine } from "./MovementRuleEngine";

export function getPlacementRows(player: Player): readonly number[];
export function getScoringRow(player: Player): number; // SCORING_ZONE_PLAYER1 / _PLAYER2
/** Casillas vacías de las filas de despliegue con < MAX_PIECES_PER_ROW piezas propias. */
export function getBenchPlacementSquares(board: Board, player: Player): Position[];
/** < PIECES_TO_PLACE piezas propias en tablero y banca no vacía. Sin chequeo de turno. */
export function canPlaceFromBench(board: Board, player: Player, playerState: PlayerState): boolean;
export function hasAnyLegalMove(board: Board, player: Player, engine: MovementRuleEngine): boolean;
export function hasAnyLegalAction(
  board: Board,
  player: Player,
  playerState: PlayerState,
  engine: MovementRuleEngine,
): boolean; // canPlaceFromBench || hasAnyLegalMove
```

- `getBenchPlacementSquares` recorre filas en orden de `getPlacementRows` y columnas 0..4.
- En `GameState.ts` reemplazar:
  - el bloque de `validPositions` en `selectPieceTypeForSetup` y en `selectBenchPiece` por
    `getBenchPlacementSquares(state.board, state.currentPlayer)`;
  - en `canPlaceBenchPiece` el cálculo interno por
    `canPlaceFromBench(state.board, state.currentPlayer, state.getCurrentPlayerState())`
    (conservar los guards de `isLocalPlayerTurn` y fase);
  - las validaciones de fila/ocupación/`MAX_PIECES_PER_ROW` en `placePieceInSetup` y
    `placeBenchPiece` por `getBenchPlacementSquares(...).some(p => p.equals(position))`.
- `checkGameOver` puede usar `hasAnyLegalMove` para ambos jugadores (misma semántica).

## Fuera de Alcance

- No agregar `resolveStalledTurn` (Task 03) ni tocar `handleTileClick` (Task 04).
- No cambiar reglas ni `MovementRuleEngine`.

## Verificación

- [ ] Tests nuevos: squares en tablero vacío (15 para cada jugador), fila con 2 piezas propias
      queda excluida, `canPlaceFromBench` false con 5 en tablero o banca vacía,
      `hasAnyLegalAction` false con tablero sin piezas y banca vacía.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate` — todos los tests existentes siguen verdes.
- [ ] `pnpm typecheck`

## Handoff

- Produce: `turnRules.ts` usado por Tasks 03, 04, 06 y 07.

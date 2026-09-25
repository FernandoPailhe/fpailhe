# Task 01: Índice de posiciones O(1) en `Board`

> Parte del plan: `../plan.md` — ver "Qué agrega Hard sobre Medium" (rendimiento).

## Skill / Capa

`.devin/skills/rugby-chess-domain/SKILL.md` (entidades).

## Objetivo

`Board.getPieceAt` hoy recorre todas las piezas; el motor lo llama muchas veces por jugada.
Indexarlo acelera todos los bots (y el juego) sin cambiar la API.

## Depende De

- Nada.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/domain/entities/Board.ts` — editar.
- `apps/web/src/lab/trymate/domain/entities/Board.test.ts` — crear o ampliar.

## Detalles de Implementación

- Campo privado `positionIndex: Map<string, string>` (clave `"x,y"` → `pieceId`).
- Mantenerlo en `addPiece`, `removePiece`, `movePiece`, `reset`.
- `getPieceAt(pos)`: buscar en el índice; **verificar** que la pieza encontrada siga en esa
  posición (`piece.position?.equals(pos)`). Si no coincide o no hay entrada pero podría haber
  (piezas movidas por fuera con `GamePiece.moveTo`, como hace hoy el store), llamar a
  `rebuildIndex()` y reintentar. Así el índice nunca devuelve algo incorrecto.
- Opcional: `getPiecesOf(player)` cacheado (invalidado en cada mutación).

## Fuera de Alcance

- No cambiar el store para dejar de usar `piece.moveTo` directo (la verificación lo cubre).

## Verificación

- [ ] Test: `addPiece`/`movePiece`/`removePiece`/captura mantienen `getPieceAt` correcto.
- [ ] Test: mover una pieza con `piece.moveTo` por fuera → `getPieceAt` en la nueva y la vieja
      posición sigue correcto.
- [ ] Micro-benchmark en test (solo log): 100 000 `getPieceAt` con 16 piezas, antes/después.
- [ ] Toda la suite de `lab/trymate` verde: `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: `Board` más rápido para Tasks 02–06.

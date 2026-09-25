# Task 04: Prioridad de banca en `handleTileClick`

> Parte del plan: `../plan.md` — ver "P2 — La prioridad de banca bloquea movimientos".

## Skill / Capa

Seguir `.devin/skills/rugby-chess-state/SKILL.md` (sección "handleTileClick Is the Only Entry Point").

## Objetivo

Que con banca disponible el jugador pueda seguir moviendo piezas a casillas vacías.

## Depende De

- Task 02: `getBenchPlacementSquares`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/GameState.ts` — editar `handleTileClick`.
- `apps/web/src/lab/trymate/application/GameState.test.ts` — agregar tests.
- `.devin/skills/rugby-chess-state/SKILL.md` — actualizar el punto 3 de la lista de `handleTileClick`.

## Detalles de Implementación

Reemplazar el paso 1 de `handleTileClick` por:

```ts
// 1. Banca (acción libre): solo con pieza de banca seleccionada, o sin pieza de
//    tablero seleccionada y sobre una casilla de despliegue válida.
if (state.gamePhase === GamePhase.PLAYING && state.canPlaceBenchPiece() && !clickedPiece) {
  const isPlacementSquare = getBenchPlacementSquares(state.board, state.currentPlayer).some((p) =>
    p.equals(position),
  );
  if (state.selectedBenchPiece || (!state.selectedPiece && isPlacementSquare)) {
    state.placeBenchPiece(position);
    return;
  }
}
```

El resto (paso 2 movimiento confirmado, paso 3 `selectTile`) queda igual.

## Fuera de Alcance

- No cambiar `placeBenchPiece` ni el flujo del `BenchPieceDialog`.

## Verificación

- [ ] Test: BLANCAS con 4 piezas + 1 de banca, selecciona un PIONEER y clickea un destino
      vacío fuera de filas 1–3 → la pieza se mueve y cambia el turno.
- [ ] Test: mismo escenario con destino válido dentro de filas 1–3 → se mueve (no baja banca).
- [ ] Test existente "places a bench piece as a free action that keeps the turn" sigue verde.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: interacción humana correcta con banca; el bot (Task 07) no usa `handleTileClick`.

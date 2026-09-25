# Task 03: Pase automático / fin de partida sin acciones legales

> Parte del plan: `../plan.md` — ver "P1 — Turno trabado sin movimientos legales".

## Skill / Capa

Seguir `.devin/skills/rugby-chess-state/SKILL.md` sobre `apps/web/src/lab/trymate/application/GameState.ts`.

## Objetivo

Que ningún estado de PLAYING quede sin salida: si el jugador de turno no puede mover ni
bajar banca, pasa automáticamente; si ninguno puede, termina la partida.

## Depende De

- Task 02: `hasAnyLegalAction`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/GameState.ts` — editar.
- `apps/web/src/lab/trymate/domain/entities/GameSnapshot.ts` — editar (campo opcional).
- `apps/web/src/lab/trymate/components/GameStatusBar.tsx` — editar (aviso).
- `apps/web/src/lab/trymate/application/GameState.test.ts` — agregar tests.
- `apps/web/src/lab/trymate/domain/entities/GameSnapshot.test.ts` — agregar test de roundtrip.

## Detalles de Implementación

1. Store: agregar `lastPassedPlayer: Player | null` (inicial `null`, también en `reset`,
   `quickStart`, `prepareOnlineGame`, `applyRemoteSnapshot`, `toSnapshot`).
2. Acción nueva:

```ts
resolveStalledTurn: () => {
  const s = get();
  if (s.gamePhase !== GamePhase.PLAYING) return;
  const stateOf = (p: Player) => (p === Player.BLANCAS ? s.player1State : s.player2State);
  const current = s.currentPlayer;
  const other = current === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS;
  if (hasAnyLegalAction(s.board, current, stateOf(current), s.movementEngine)) return;
  if (hasAnyLegalAction(s.board, other, stateOf(other), s.movementEngine)) {
    set({ currentPlayer: other, lastPassedPlayer: current });
    return;
  }
  set({ gamePhase: GamePhase.GAME_OVER });
},
```

3. Llamar `get().resolveStalledTurn()` **fuera** del callback de `set` (evitar `set` anidado):
   - al final de `movePiece` (después del `set` que cambia `currentPlayer`) — convertir
     `movePiece` a `(to) => { set(...); get().resolveStalledTurn(); }`;
   - al final de `placeBenchPiece` (igual patrón);
   - al pasar a `PLAYING` en `selectPieceTypeForBench`, `quickStart` y `prepareOnlineGame("quick")`.
4. En `movePiece`, setear `lastPassedPlayer: null` en el objeto que devuelve.
5. `checkGameOver` sigue igual para el caso de puntos; el caso "ninguno puede mover" ahora lo
   cubre `resolveStalledTurn` (se puede dejar el existente, es idempotente).
6. Snapshot: `GameSnapshot.lastPassedPlayer?: Player | null`; `deserializeGameSnapshot`
   devuelve `snap.lastPassedPlayer ?? null`. RTDB borra `null`, por eso opcional.
7. `GameStatusBar`: reemplazar el badge "No legal moves — bench or move required" por
   `{lastPassedPlayer && <span ...>{PLAYER_LABEL[lastPassedPlayer]} had no legal moves — turn passed</span>}`
   usando las mismas clases de token del badge actual.

## Fuera de Alcance

- No tocar `handleTileClick` (Task 04). No agregar modo VS_COMPUTER.
- No agregar botón manual de "Pass".

## Verificación

- [ ] Test: BLANCAS mueve y NEGRAS queda con piezas sin movimientos y banca vacía, BLANCAS con
      movimientos → tras el movimiento `currentPlayer === BLANCAS` y `lastPassedPlayer === NEGRAS`.
- [ ] Test: ninguno con acciones tras un movimiento → `GAME_OVER`.
- [ ] Test: jugador sin movimientos pero con banca y < 5 piezas → NO pasa.
- [ ] Test snapshot roundtrip con y sin `lastPassedPlayer`.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: `resolveStalledTurn()` y `lastPassedPlayer`, usados por Task 07 y Task 09.

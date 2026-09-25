# Task 05: Modo `VS_COMPUTER` y gating de turno

> Parte del plan: `../plan.md` — ver "Entidades / Tipos Nuevos" y "Pantallas / Componentes".

## Skill / Capa

`.devin/skills/rugby-chess-domain/SKILL.md` (enum) + `.devin/skills/rugby-chess-state/SKILL.md`
(store). Componentes: solo cambios de condición, sin estilos nuevos.

## Objetivo

Agregar el modo de juego contra la computadora (sin bot todavía): el humano juega BLANCAS,
NEGRAS queda bloqueado para la UI, y "Play again" conserva el modo.

## Depende De

- Task 03 y Task 04 (los fixes van antes, por orden del plan).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/domain/constants/GameRules.ts` — agregar `VS_COMPUTER`.
- `apps/web/src/lab/trymate/application/GameState.ts` — editar.
- `apps/web/src/lab/trymate/components/TryMateBoard.tsx` — editar `notMyTurn`.
- `apps/web/src/lab/trymate/components/PiecePickerDialog.tsx` — editar `isLocalTurn`.
- `apps/web/src/lab/trymate/components/BenchPieceDialog.tsx` — editar `isLocalTurn`.
- `apps/web/src/lab/trymate/components/GameOverPanel.tsx` — "Play again" → `playAgain()`.
- `apps/web/src/lab/trymate/TryMatePage.tsx` — `isLocalPVP` → `gameMode === GameMode.PVP`.
- `apps/web/src/lab/trymate/application/GameState.test.ts` — tests.

## Detalles de Implementación

1. `export enum GameMode { PVP = "PVP", ONLINE = "ONLINE", VS_COMPUTER = "VS_COMPUTER" }`
2. Store — nuevos campos/acciones:

```ts
botLayoutId: string | null;                 // inicial null (lo setea Task 07)
startVsComputer: (setupMode: SetupTurnMode) => void;
playAgain: () => void;
getBotPlayer: () => Player | null;
```

- `startVsComputer(mode)`: `get().reset(mode)` y luego
  `set({ gameMode: GameMode.VS_COMPUTER, localPlayer: Player.BLANCAS, roomId: null })`.
- `getBotPlayer()`: `gameMode === VS_COMPUTER && localPlayer ? opuesto(localPlayer) : null`.
- `playAgain()`: si `gameMode === VS_COMPUTER` → `startVsComputer(setupMode)`; si no →
  `reset(setupMode)` (comportamiento actual).

3. Cambiar la semántica "modo local" de `gameMode !== ONLINE` a `gameMode === PVP`:
   - `isLocalPlayerTurn`: `state.gameMode === GameMode.PVP || state.localPlayer === null || state.localPlayer === state.currentPlayer`
   - `isSetupTurnForLocalPlayer`: misma condición con `GameMode.PVP`.
   - `PiecePickerDialog` / `BenchPieceDialog`: `gameMode === GameMode.PVP || localPlayer === null || localPlayer === currentPlayer`.
   - `TryMateBoard`: `const notMyTurn = gameMode !== GameMode.PVP && !isLocalPlayerTurn();`
     (`flipped` queda solo para ONLINE).
   - `TryMatePage`: `const isLocalPVP = gameMode === GameMode.PVP;` → en VS_COMPUTER con
     setup HIDDEN no se muestra la pantalla de pase de dispositivo al humano.
4. `quickStart` hoy retorna si ONLINE: dejarlo así (VS_COMPUTER puede usar quick start).
   Verificar que no pise `gameMode`/`localPlayer` (no lo hace hoy).

## Fuera de Alcance

- No crear el bot, `runBotTurn` ni el hook (Tasks 06–08).
- No agregar el botón del menú ni labels nuevos (Task 09).

## Verificación

- [ ] Test: tras `startVsComputer(ALTERNATING)`: `gameMode === VS_COMPUTER`,
      `localPlayer === BLANCAS`, `getBotPlayer() === NEGRAS`, `isLocalPlayerTurn()` true;
      después de una colocación de BLANCAS, `isLocalPlayerTurn()` false y
      `handleTileClick` de NEGRAS no hace nada.
- [ ] Test: `playAgain()` en VS_COMPUTER conserva modo y `localPlayer`; en PVP deja PVP.
- [ ] Tests de ONLINE (`OnlineFlow.test.ts`) y PVP siguen verdes.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: `GameMode.VS_COMPUTER`, `startVsComputer`, `getBotPlayer`, `playAgain`, `botLayoutId`.

# Task 08: Turno del bot asíncrono y cancelable

> Parte del plan: `../plan.md` — ver `choosePlayActionAsync` en "Contratos compartidos".

## Skill / Capa

`.devin/skills/rugby-chess-state/SKILL.md` (store) + hook `useComputerTurn`.

## Objetivo

Soportar bots que devuelven su jugada en una `Promise` (Hard), sin romper Easy/Medium, y
descartar resultados viejos si la partida cambió mientras el bot pensaba.

## Depende De

- Nada de este plan (usa `ComputerPlayer` del plan Easy agnóstico).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/ComputerPlayer.ts` — agregar método opcional.
- `apps/web/src/lab/trymate/application/GameState.ts` — editar.
- `apps/web/src/lab/trymate/application/useComputerTurn.ts` — editar.
- Tests: `BotFlow.test.ts`, `useComputerTurn.test.ts`.

## Detalles de Implementación

1. `ComputerPlayer`: dos métodos opcionales:
   - `choosePlayActionAsync?(ctx: BotContext, signal: AbortSignal): Promise<BotPlayAction[]>`.
   - `prepareSetupAsync?(ctx: BotContext, signal: AbortSignal): Promise<void>` — cálculo pesado
     previo a las decisiones de setup/banca (Hard planifica su ejército en el worker). Después,
     `chooseSetupPlacement`/`chooseBenchType` sync usan lo preparado.
2. Store:
   - `botThinking: boolean` (estado reactivo para la UI).
   - `getBotTurnToken(): string` = `${gamePhase}|${currentPlayer}|${moveHistory.getTotalMoves()}|${bench counts}|${isViewingHistory}|${roomId ?? ""}|${controllerId}`.
   - Separar `runBotTurn` en:
     - `buildBotContext(rng): BotContext | null` (lo que hoy arma el contexto; `null` si no es turno del bot).
     - `applyBotAction(action: BotPlayAction): boolean` (lo que hoy aplica con `botActing`).
   - `runBotTurn(rng?)` sync queda igual para bots sin async (setup y PLAYING de Easy/Medium, y setup de Hard).
   - Nueva `runBotTurnAsync(signal: AbortSignal, rng?): Promise<boolean>`:
     1. `ctx = buildBotContext(rng)`; si `null` → `false`.
     2. Fase SETUP/BENCH_SELECTION: si el controller tiene `prepareSetupAsync`, `await` (con token,
        `botThinking` y descarte igual que abajo) y luego `runBotTurn(rng)`. Si no → `runBotTurn(rng)`.
        Fase PLAYING sin `choosePlayActionAsync` → `runBotTurn(rng)`.
     3. `token = getBotTurnToken()`; `set({ botThinking: true })`.
     4. `actions = await controller.choosePlayActionAsync(ctx, signal)` (en `try/finally` → `botThinking: false`).
     5. Si `signal.aborted` o `getBotTurnToken() !== token` → `false` (descartar).
     6. Aplicar cada acción en orden con `applyBotAction`; si alguna falla → cortar y `resolveStalledTurn()`.
3. Hook `useComputerTurn`: usar `runBotTurnAsync` con un `AbortController` por efecto; el cleanup
   hace `abort()`. Mantener la lógica de re-agenda (`tick`). El delay previo se reduce a
   `max(0, delay − tiempoDeBúsqueda)` cuando el bot es async (el pensamiento ya es la espera).
4. `reset`, `startVsComputer`, `playAgain`, `setOnlineContext` y entrar al historial invalidan el
   token (cambian alguno de sus componentes); no hace falta más.

## Fuera de Alcance

- El bot Hard en sí (Task 11). UI del indicador (Task 12).

## Verificación

- [ ] Easy/Medium: todos los tests de BotFlow y del hook verdes sin cambios de comportamiento.
- [ ] Controller async falso que resuelve en 50 ms: el hook aplica sus acciones; `botThinking`
      pasa a true y vuelve a false.
- [ ] Mientras "piensa": `goBackInHistory()` → la respuesta se descarta; `reset()` → se descarta;
      desmontar el hook → `abort` llamado.
- [ ] Acciones `[bench, move]` se aplican en orden en un solo turno.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate` + `pnpm typecheck`

## Handoff

- Produce: `runBotTurnAsync`, `botThinking`, hook cancelable.

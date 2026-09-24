# Task 11: Fachada `MediumBot` y registro

> Parte del plan: `../plan.md` — ver "Arquitectura de la IA".

## Skill / Capa

Application (ai) + registro en `ComputerPlayer.ts`.

## Objetivo

Unir introspección, postura, búsqueda, banca y despliegue en un `ComputerPlayer` "medium".

## Depende De

- Task 01 (`ComputerPlayer`, `registerComputerPlayer`), Task 08, Task 09, Task 10, Task 07, Task 04.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/MediumBot.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/MediumBot.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/ComputerPlayer.ts` — registrar `medium`.

## Detalles de Implementación

```ts
export interface MediumDecision { posture: Posture; depth: number; nodes: number; top: { move: SimMove; score: number }[] }
export interface MediumBot extends ComputerPlayer { readonly lastDecision: MediumDecision | null }
export function createMediumBot(rng: Rng): MediumBot;
```

- `insight(ctx) = getRulesInsight(ctx.rules, ctx.engine, ctx.engine.config, MEDIUM_BOT_CONFIG.valueOverrides)`
  (memoizado por fingerprint; `engine.config` es público desde Task 02).
- `chooseSetupPlacement(ctx)` → `setupStrategy.chooseSetupPlacement(ctx, insight)`.
- `chooseBenchType(ctx)` → `setupStrategy.chooseBenchType(ctx, insight, targetComposition(insight))`.
- `choosePlayAction(ctx)`:
  1. `sim = simFromContext(ctx)`; `A = analyzeBoard(sim.board, ctx.engine, insight)`.
  2. `posture = choosePosture(sim, ctx.bot, ctx.engine, insight, A)`; `weights = weightsFor(posture)`.
  3. `chooseBenchPlacement(...)` → si hay, `{ kind: "bench", ... }`.
  4. `searchBestMove(sim, ctx.bot, ctx.engine, insight, weights, ctx.rng)` → guardar `lastDecision`;
     `move` → `{ kind: "move", pieceId, to }`; `null` → `{ kind: "pass" }`.
- No mutar nada de `ctx`. `registerComputerPlayer("medium", createMediumBot)` al cargar el módulo
  (importar `MediumBot.ts` desde `ComputerPlayer.ts` o desde el store).

## Fuera de Alcance

- UI (Task 12). Tuning más allá de lo necesario para Task 13.

## Verificación

- [ ] Store: `startVsComputer(ALTERNATING, "medium")` + humano por acciones públicas + `runBotTurn`
      en loop → PLAYING con despliegue válido del bot. Ídem HIDDEN y quick start.
- [ ] En PLAYING con banca disponible: primera acción `bench`, luego `move`.
- [ ] `lastDecision` se completa en cada movimiento.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate` + `pnpm typecheck` + `pnpm lint`

## Handoff

- Produce: dificultad "medium" funcional.

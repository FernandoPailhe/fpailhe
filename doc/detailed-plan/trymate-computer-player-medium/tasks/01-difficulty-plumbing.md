# Task 01: Interfaz `ComputerPlayer`, dificultad en el store y Easy agnóstico

> **Si `trymate-rules-agnostic-easy` está implementado:** solo agregar `"medium"` a `BotDifficulty` y verificar lo demás; el resto ya existe (ver `../plan.md#relación-con-trymate-rules-agnostic-easy-ejecutar-ese-plan-primero`).

> Parte del plan: `../plan.md` — ver "Contratos compartidos" y "Reglas para el código del bot".

## Skill / Capa

`.devin/skills/rugby-chess-state/SKILL.md` (store) sobre `apps/web/src/lab/trymate/`.

## Objetivo

Que el store corra cualquier bot por una interfaz común con la dificultad elegida, y que
Easy deje de depender de tipos de pieza y coordenadas fijas.

## Depende De

- Plan `trymate-computer-player` implementado.
- Task 02: `RulesView`/`CURRENT_RULES`, `getCaptureSquares`, `feasibleTypes`, `turnRules` con `rules`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/ComputerPlayer.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/rng.ts` — crear (`createSeededRng(seed): Rng`, mulberry32; mover `Rng` acá).
- `apps/web/src/lab/trymate/application/ai/EasyBot.ts` — editar.
- `apps/web/src/lab/trymate/application/ai/EasyBot.test.ts` — actualizar.
- `apps/web/src/lab/trymate/application/GameState.ts` — editar.
- `apps/web/src/lab/trymate/application/BotFlow.test.ts` — actualizar.

## Detalles de Implementación

1. `ComputerPlayer.ts`: `BotDifficulty`, `BotContext` (incluye `rules: RulesView`),
   `ComputerPlayer` como en `../plan.md#contratos-compartidos`, y registro:

```ts
const FACTORIES: Partial<Record<BotDifficulty, (rng: Rng) => ComputerPlayer>> = { easy: createEasyBot };
export function registerComputerPlayer(d: BotDifficulty, f: (rng: Rng) => ComputerPlayer): void;
export function createComputerPlayer(difficulty: BotDifficulty, rng: Rng): ComputerPlayer; // fallback a easy
```

2. **Easy agnóstico** (`EasyBot.ts`), comportamiento equivalente con reglas actuales:
   - `getThreatenedSquares(board, bot, engine)` → unión de `engine.getCaptureSquares(p, board)`
     de cada pieza rival.
   - Fila de anotación y dirección desde `ctx.rules` (`scoringRow`, `forward`).
   - Setup: **quitar** la dependencia de `QUICK_START_LAYOUTS`. Nuevo
     `randomSetupPlacement(ctx)`: tipos de `feasibleTypes(...)` (Task 02) ×
     `getBenchPlacementSquares(board, bot, rules)`, elegir con `rng`.
     Banca: tipos con déficit primero (factibilidad), si no, al azar entre factibles.
   - `createEasyBot(rng): ComputerPlayer` que delega en esas funciones.
3. Store:
   - Campos `botDifficulty: BotDifficulty` (default `"easy"`), `botController: ComputerPlayer | null`;
     eliminar `botLayoutId`.
   - `startVsComputer(setupMode, difficulty = get().botDifficulty)` crea
     `createComputerPlayer(difficulty, Math.random)`.
   - `playAgain()` conserva `botDifficulty`. `reset()` → `botController: null`.
   - `runBotTurn(rng?)` arma `BotContext` con `rules: CURRENT_RULES` y
     `board = HIDDEN && SETUP ? boardWithOnlyOwner(board, bot) : board` (helper local que clona).

## Fuera de Alcance

- Medium (Task 11). UI (Task 12).

## Verificación

- [ ] Tests de Easy actualizados y verdes; `grep -n "PieceType\.\|QUICK_START\|GAME_CONFIG" apps/web/src/lab/trymate/application/ai/EasyBot.ts` vacío.
- [ ] BotFlow: partidas vs Easy en ALTERNATING, HIDDEN y quick start llegan a PLAYING/GAME_OVER.
- [ ] Spy: en HIDDEN SETUP el controller no recibe piezas BLANCAS.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate`
- [ ] `pnpm typecheck`

## Handoff

- Produce: `ComputerPlayer`, `BotContext`, `registerComputerPlayer`, `createSeededRng`, Easy agnóstico.

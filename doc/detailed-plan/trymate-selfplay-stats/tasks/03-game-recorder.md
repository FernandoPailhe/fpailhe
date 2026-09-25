# Task 03: Grabador de partidas y re-juego

> Parte del plan: `../plan.md` — ver "Registro de partida" y "Experimentos" (diversidad).

## Skill / Capa

`selfplay/core` (TS puro) sobre la arena del plan Easy agnóstico.

## Objetivo

Jugar **una** partida completa entre dos bots con reglas dadas y devolver su `GameRecord`,
incluyendo setup, aperturas aleatorias, decisiones y métricas; y poder re-jugarla desde el
registro para verificar integridad.

## Depende De

- Task 01 (esquema, codec), Task 02 (`DecisionInfo`). Plan Easy agnóstico: `SimState`,
  `applySimMove`/`applySimBench`, `generateMoves`, `feasibleTypes`, `generateRandomArmy`,
  `getBenchPlacementSquares`, árbitro de `arena.ts`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/core/playRecordedGame.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/core/metrics.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/core/replay.ts` — crear.
- Tests de los tres.
- `apps/web/src/lab/trymate/application/ai/arena.ts` — editar solo si hace falta extraer el
  árbitro a funciones reutilizables (sin cambiar su API pública).

## Detalles de Implementación

```ts
export interface GameSpec {
  id: string;
  batchId: string;
  seed: number;
  gitSha: string | null;
  variant: RuleVariant; // { name, rules, engine }
  players: Record<Player, { spec: PlayerSpec; create: (rng: Rng) => ComputerPlayer }>;
  setupMode: "ALTERNATING" | "HIDDEN" | "RANDOM";
  opening: { randomPlies: number; epsilon: number };
  maxPlies: number;
  recordPositions: boolean;
}
export function playRecordedGame(spec: GameSpec): GameRecord;
```

1. `rng` maestro = `createSeededRng(spec.seed)`; derivar rngs independientes por jugador y para la
   apertura (`createSeededRng(seed ^ 0x9e3779b9)`, etc.) para que cambiar un bot no altere el azar del otro.
2. **Setup:**
   - `ALTERNATING`/`HIDDEN`: igual que el árbitro de la arena (en HIDDEN cada bot ve solo lo suyo),
     validando cada colocación; guardar `setup[player].order` (orden de colocación).
   - `RANDOM`: `generateRandomArmy(rules, player, rng)` para ambos.
3. **Juego:** por ply:
   - Si `n < randomPlies` y `rngApertura() < epsilon`: acción legal al azar (movimientos + bajadas
     posibles), `random: true`, agregar `n` a `opening.randomActions`.
   - Si no: `choosePlayAction(ctx)`; `decision` = `getLastDecisionInfo?.()` serializado
     (`top[].a` = acción como string corto `m:<id>:x,y` / `b:<tipoIdx>:x,y` / `p`).
   - `pos = encodePosition(state)` antes de aplicar (si `recordPositions`).
   - Aplicar con `applySimMove`/`applySimBench`; ilegal → lanzar `IllegalActionError` con detalle
     (el runner lo registra como partida fallida, no la guarda como válida).
   - Auto-pase/bloqueo mutuo como `resolveStalledTurn`; `maxPlies` → `reason: "maxPlies"`.
4. `metrics.ts`: `computeSideMetrics(record): Record<Player, SideMetrics>` recorriendo plies con un
   `SimState` reconstruido (progreso vía `|y − homeRow|`).
5. `replay.ts`: `replayGame(record): { ok: boolean; mismatchAt?: number }` — reconstruye reglas
   (`rulesFromSnapshot`, `new MovementRuleEngine(record.rules.pieceConfig)`), aplica setup y plies
   verificando legalidad, `pos` y resultado final.

## Fuera de Alcance

- Archivos, workers, CLI (Task 05).

## Verificación

- [ ] Easy vs Easy, 20 partidas × (reglas actuales, 7×13): `validateGameRecord` ok y `replayGame` ok.
- [ ] Determinismo: mismo `GameSpec` → registro idéntico salvo `durationMs`/`ms`/`createdAt`.
- [ ] Con `epsilon: 1, randomPlies: 4` las primeras 4 jugadas son `random: true`.
- [ ] Un bot falso que devuelve una jugada ilegal → `IllegalActionError`.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/selfplay` + `pnpm typecheck`

## Handoff

- Produce: `playRecordedGame`, `computeSideMetrics`, `replayGame`.

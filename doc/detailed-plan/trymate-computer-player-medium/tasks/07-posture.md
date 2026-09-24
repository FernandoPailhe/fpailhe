# Task 07: Posturas ATTACK / DEFEND / BALANCED

> Parte del plan: `../plan.md` — ver "Posturas, búsqueda, banca y despliegue".

## Skill / Capa

Application pura.

## Objetivo

Elegir al inicio de cada turno un plan que cambia los pesos: frenar al rival, empujar un
corredor o jugar equilibrado. Umbrales relativos al tablero.

## Depende De

- Task 05 (`analyzeBoard`), Task 06 (`TermWeights`, `NEUTRAL_WEIGHTS`, `materialOf`, `Posture`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/medium/posture.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/posture.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/config.ts` — agregar perfiles.

## Detalles de Implementación

`config.ts`:

```ts
export const POSTURE_WEIGHTS: Record<Posture, Partial<TermWeights>> = {
  DEFEND:   { containment: 1.8, runnerThreat: 1.8, hanging: 1.2, progress: 0.7 },
  ATTACK:   { progress: 1.4, freeLane: 1.5, cohesion: 0.8, containment: 0.8 },
  BALANCED: {},
};
export const POSTURE_RULES = { attackMaterialLeadRatio: 0.8 } as const; // × valor medio de pieza (≈ 25 con media 30)
```

`posture.ts`:

```ts
export function choosePosture(state: SimState, bot: Player, engine: MovementRuleEngine, insight: RulesInsight, analysis?: BoardAnalysis): Posture;
export function weightsFor(p: Posture): TermWeights; // { ...NEUTRAL_WEIGHTS, ...POSTURE_WEIGHTS[p] }
```

Orden (primero que aplica), con `G = insight.geometry`, `opp = opponentOf(bot)`:
1. **DEFEND**: pieza de `opp` con `distToGoal ≤ G.runnerZone` y `!isAdvanceControlled(p, bot)`,
   o `scores[opp] === rules.pointsToWin − 1`.
2. **ATTACK**: pieza del bot con `hasFreeLane` y `distToGoal ≤ G.runnerZone + 1`; o
   `materialOf(bot) − materialOf(opp) ≥ attackMaterialLeadRatio × valorMedio`; o
   `scores[bot] > scores[opp]` sin piezas de `opp` con `distToGoal ≤ G.runnerZone + 1`.
3. **BALANCED**.

## Fuera de Alcance

- La postura no cambia por hoja: se calcula en la raíz (Task 11).

## Verificación

- [ ] Reglas actuales: rival a 3 de anotar sin control → DEFEND aunque el bot tenga carril libre;
      con su avance atacado → no DEFEND; PIONEER propio con carril libre a 4 → ATTACK; posición
      de quick start → BALANCED.
- [ ] Variante 7×13: rival a `runnerZone` (4) → DEFEND; a 6 → no.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/medium` + `pnpm typecheck`

## Handoff

- Produce: `choosePosture`, `weightsFor`.

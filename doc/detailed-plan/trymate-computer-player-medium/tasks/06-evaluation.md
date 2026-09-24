# Task 06: Función de evaluación Medium

> Parte del plan: `../plan.md` — ver "Evaluación" (tabla de términos).

## Skill / Capa

Application pura (`application/ai/medium/`).

## Objetivo

Un número que diga qué tan buena es una posición para el bot, con desglose por término, sin
ningún valor atado a un tipo de pieza ni al tamaño del tablero.

## Depende De

- Task 05 (`analyzeBoard`), Task 04 (`RulesInsight`), Task 03 (`SimState`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/medium/config.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/evaluation.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/evaluation.test.ts` — crear.

## Detalles de Implementación

`config.ts`:

```ts
export type EvalTerm = "points" | "material" | "progress" | "hanging" | "cohesion" | "containment" | "runnerThreat" | "freeLane" | "mobility";
export type TermWeights = Record<EvalTerm, number>;
export type Posture = "ATTACK" | "DEFEND" | "BALANCED";

export const MEDIUM_BOT_CONFIG = {
  valueOverrides: {} as Partial<Record<string, number>>, // opcional, por nombre de tipo
  benchFactor: 0.8,
  pointValue: 400,
  winValue: 100_000,
  runner: { base: 60, exponent: 1.3, threatFactor: 1.5 },
  hanging: { undefended: 0.9, defended: 0.25, sideToMoveFactor: 0.5 },
  cohesion: { supported: 6, isolated: -8, stretchPerRow: -5 },
  containment: { perAdvanceMove: -1, plugged: 12, fullyControlled: 8 },
  freeLane: { perRow: 12 },
  mobility: 1.5,
  search: { depth: 2, endgameDepth: 3, nodeBudget: 20_000, tolerance: 6, blunderChance: 0.05 },
} as const;
export const NEUTRAL_WEIGHTS: TermWeights = { points: 1, material: 1, progress: 1, hanging: 1, cohesion: 1, containment: 1, runnerThreat: 1, freeLane: 1, mobility: 1 };
```

`evaluation.ts`:

```ts
export type EvalBreakdown = Record<EvalTerm, number> & { total: number };
export const runnerBonus = (d: number, insight: RulesInsight): number; // d ≤ runnerZone ? base / d^exponent : 0 (d ≥ 1)
export function materialOf(state: SimState, side: Player, insight: RulesInsight): number;
export function explainEvaluation(state: SimState, bot: Player, engine: MovementRuleEngine, insight: RulesInsight, weights?: TermWeights, analysis?: BoardAnalysis): EvalBreakdown;
export function evaluate(...mismos params): number;
```

Con `opp = opponentOf(bot)`, `A = analysis ?? analyzeBoard(state.board, engine, insight)`,
`V(p) = insight.profiles.get(p.type).value`, `d(p) = insight.distToGoal(p)`, `G = insight.geometry`.
Salvo aclaración, cada término = `F(bot) − F(opp)`:

1. **Terminal:** `state.winner` → `±winValue` y nada más.
2. **points:** `scores[side] × pointValue`.
3. **material:** Σ `V(p)` en tablero + `benchFactor ×` Σ `V` de `bench[side]`.
4. **progress:** Σ `profile.forwardReach × insight.progress(p) + runnerBonus(d(p))`.
5. **hanging:** por pieza con `A.isAttacked(pos, opponentOf(side))`: `−V × (A.isDefended ? defended : undefended)`, × `sideToMoveFactor` si `side === state.current`.
6. **cohesion:** por pieza con `progress ≥ G.runnerZone` y `A.isDefended` → `+supported`;
   `A.isIsolated && !A.hasFreeLane` → `+isolated`; y `stretchPerRow × max(0, líder − segundo − G.stretchSlack)`
   (progress de las dos piezas más avanzadas, si ≥ 2 piezas y el líder no tiene carril libre).
7. **containment** (de `side` sobre piezas del rival): `perAdvanceMove × A.advanceMoves(r).length`;
   `+plugged` si `A.isPlugged(r, side)`; `+fullyControlled` si `A.advanceMoves(r).length > 0 && A.isAdvanceControlled(r, side)`.
8. **runnerThreat** (solo resta al bot): por pieza de `opp` con `d ≤ G.runnerZone + 1` y
   `!A.isAdvanceControlled(p, bot)` → `−threatFactor × max(runnerBonus(d), base / (G.runnerZone + 1)^exponent)`.
9. **freeLane:** por pieza con `A.hasFreeLane` → `+perRow × (G.runnerZone + 2 − min(d, G.runnerZone + 2))`.
10. **mobility:** `mobility × A.legalMoveCount(side)`.

`total = Σ weights[t] × término[t]`. Un solo `analyzeBoard` por llamada.

## Fuera de Alcance

- Posturas (Task 07), búsqueda (Task 08).

## Verificación

- [ ] Posición espejada simétrica con mismos puntos → todos los términos simétricos ≈ 0.
- [ ] Mover una pieza a casilla atacada sin defensa baja `hanging` ≈ `0.9 × V`.
- [ ] Taponar un corredor rival sube `containment` ≥ `plugged`.
- [ ] Rival a 2 de anotar sin control → `runnerThreat < 0`.
- [ ] Misma batería en variante 7×13: signos iguales (los números cambian, la dirección no).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/medium` + `pnpm typecheck`

## Handoff

- Produce: `evaluate`, `explainEvaluation`, `materialOf`, `runnerBonus`, `MEDIUM_BOT_CONFIG`, `TermWeights`, `Posture`.

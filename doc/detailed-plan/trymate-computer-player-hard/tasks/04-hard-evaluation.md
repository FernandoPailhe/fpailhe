# Task 04: Evaluación Hard (SEE, carrera, pesos ajustables)

> Parte del plan: `../plan.md` — ver "Evaluación Hard" y principio 4 (pesos ligados a reglas).

## Skill / Capa

Application pura (`application/ai/hard/`).

## Objetivo

Sumar a la evaluación de Medium dos conceptos que una búsqueda corta no ve bien —cambios de
piezas y carreras de corredores— y cargar pesos ajustados validados contra las reglas actuales.

## Depende De

- Task 02 (`SearchBoard.toSimState`). De Medium: `explainEvaluation`, `analyzeBoard`,
  `RulesInsight`, `TermWeights`, `MEDIUM_BOT_CONFIG`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/see.ts` — crear (+ test).
- `apps/web/src/lab/trymate/application/ai/hard/race.ts` — crear (+ test).
- `apps/web/src/lab/trymate/application/ai/hard/weights.ts` — crear (+ test).
- `apps/web/src/lab/trymate/application/ai/hard/weights.json` — crear (inicial = pesos de Medium).
- `apps/web/src/lab/trymate/application/ai/hard/evaluation.ts` — crear (+ test).

## Detalles de Implementación

1. **SEE** (`see.ts`):

```ts
/** Ganancia material neta para `side` si inicia la secuencia de capturas en `square`. ≥ 0 = conviene. */
export function staticExchange(
  board: Board,
  square: Position,
  side: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
): number;
export function seeBalance(
  board: Board,
  sideToMove: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
): number;
```

- Atacantes de cada bando sobre `square`: piezas cuyo `getCaptureSquares` incluye `square`.
- Algoritmo clásico "swap list": alternar capturando con el atacante de **menor** `value`,
  simulando sobre un clon (o `SearchBoard` make/unmake) porque capturar puede habilitar o
  bloquear otros atacantes (bloqueos laterales). Tope 8 capturas.
- `seeBalance`: Σ max(0, SEE) de piezas rivales capturables por `sideToMove` − 0.5 × Σ del rival.

2. **Carrera** (`race.ts`):

```ts
export interface RaceInfo {
  unstoppable: boolean;
  turnsToScore: number;
  turnsToCatch: number;
}
export function analyzeRunner(sb: SearchBoard, pieceId: string, insight: RulesInsight): RaceInfo;
export function raceScore(sb: SearchBoard, bot: Player, insight: RulesInsight): number;
```

- Solo para piezas con `distToGoal ≤ runnerZone + 2` y carril libre (de `analyzeBoard`).
- `turnsToScore = ceil(distToGoal / max(1, profile.forwardReach))` (corrección: si el camino
  inmediato está ocupado, +1).
- `turnsToCatch`: BFS por turnos del rival (solo movimientos de piezas rivales, con el corredor
  quieto; profundidad ≤ `turnsToScore + 1`, cortar al llegar) hasta que alguna pieza rival
  tenga en `getCaptureSquares` una casilla del camino del corredor u ocupe su casilla de
  avance. Usar `SearchBoard.make/unmake`.
- `unstoppable = turnsToScore < turnsToCatch + (sb.current === owner ? 1 : 0)`.
- `raceScore = Σ_bot unstoppable × 0.8 × pointValue − Σ_rival ídem`.
- Cache por `hashKey(sb.hash) + pieceId` (Map acotada a 20 000).

3. **Pesos** (`weights.ts` + `weights.json`):

```json
{ "fingerprint": "<rulesFingerprint o null>", "terms": { "points": 1, "material": 1, …, "see": 1, "race": 1 }, "tunedAt": null, "games": 0 }
```

```ts
export type HardTerm = EvalTerm | "see" | "race";
export function loadHardWeights(currentFingerprint: string): {
  weights: Record<HardTerm, number>;
  stale: boolean;
};
```

- Si `fingerprint` del JSON ≠ actual (o es `null`) → pesos por defecto (`NEUTRAL_WEIGHTS` + `see: 1`, `race: 1`)
  y `stale: true`. El facade (Task 11) hace `console.warn` solo en `import.meta.env.DEV`.

4. **Desglose por bando (prerrequisito para personalidades, Task 05):** agregar a
   `medium/evaluation.ts` (sin cambiar `explainEvaluation`):

```ts
export type SideBreakdown = Record<EvalTerm, { self: number; opp: number }>;
/** Mismos cálculos que explainEvaluation, pero sin restar: F_bot y F_rival por separado.
 *  containment y runnerThreat van en `self` (los aplica el bot sobre piezas rivales). */
export function explainEvaluationSides(
  state: SimState,
  bot: Player,
  engine: MovementRuleEngine,
  insight: RulesInsight,
  analysis?: BoardAnalysis,
): SideBreakdown;
```

Test: `Σ (self − opp)` con pesos neutros == `explainEvaluation(...).total`.
`seeBalance` y `raceScore` también se exponen separados (`{ self, opp }`). 5. **Evaluación** (`evaluation.ts`):

```ts
export interface SideMultipliers { selfMul: Partial<Record<HardTerm, number>>; oppMul: Partial<Record<HardTerm, number>> }
export const NEUTRAL_SIDES: SideMultipliers = { selfMul: {}, oppMul: {} };
export function evaluateHard(sb: SearchBoard, bot: Player, insight: RulesInsight, w: Record<HardTerm, number>, postureMul: TermWeights, sides: SideMultipliers = NEUTRAL_SIDES, contempt = 0): number;
export function explainHard(…mismos): Record<HardTerm, number> & { total: number };
```

Por término `t`: `w[t] × postureMul[t] × ((selfMul[t] ?? 1) × self − (oppMul[t] ?? 1) × opp)`.
Terminal (`winner`) igual que Medium; **sin ganador y sin acciones para ambos** (bloqueo
mutuo) → `contempt`.

## Fuera de Alcance

- Tuning (Task 10). Búsqueda (Task 06).

## Verificación

- [ ] SEE (reglas actuales, escenarios): pieza defendida atacada por pieza de mayor valor → SEE < 0;
      pieza indefensa → SEE = su valor.
- [ ] Carrera: PIONEER con carril libre a 3 filas sin rivales capaces de alcanzarlo → `unstoppable`;
      con un FORT rival que llega a tiempo a atacar su camino → no.
- [ ] `loadHardWeights`: fingerprint distinto → `stale: true` y pesos por defecto.
- [ ] Variante 7×13: SEE y carrera no lanzan y dan signos coherentes.
- [ ] Con `NEUTRAL_SIDES`, `evaluateHard` == versión sin multiplicadores; con `selfMul.progress = 2`
      solo cambia la parte propia del término.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard` + `pnpm typecheck`

## Handoff

- Produce: `evaluateHard` (con `SideMultipliers` y `contempt`), `explainHard`, `explainEvaluationSides`, `loadHardWeights`, `staticExchange`.

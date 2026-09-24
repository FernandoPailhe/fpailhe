# Task 13: Tests de variantes de reglas, tácticas y arena

> **Si `trymate-rules-agnostic-easy` está implementado:** `ruleVariants`, `arena.ts` y el test de variantes Easy ya existen; esta tarea solo agrega Medium, umbrales, tácticas y perf.

> Parte del plan: `../plan.md` — ver "Criterios de Aceptación Globales" y "Agnóstico ≠ omnisciente".

## Skill / Capa

Tests (vitest) + soporte puro en `application/ai/`.

## Objetivo

Probar tres cosas por separado:
1. **Agnosticismo:** con reglas distintas, los bots juegan partidas completas y solo legales.
2. **Calidad:** con reglas actuales, Medium aplica las estrategias pedidas y le gana a Easy.
3. **Velocidad:** decisión rápida.

## Depende De

- Task 11. Usa `createSeededRng` (Task 01), `SimState` (Task 03), motor configurable (Task 02).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/testing/ruleVariants.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/arena.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/arena.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/variants.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/tactics.current-rules.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/perf.test.ts` — crear.

## Detalles de Implementación

**Variantes** (`testing/ruleVariants.ts`): cada una = `{ name, rules: RulesView, engine: MovementRuleEngine }`.
- `current`: `CURRENT_RULES` + motor por defecto.
- `wide-7x13`: `buildRulesView` con ancho 7, alto 13 (filas derivadas).
- `shallow-deploy`: profundidad de despliegue 2, `maxPerRow` 3.
- `altered-moves`: config clonado con FORT que además captura de frente y STRIKER con carga de 3.
- `more-pieces`: `piecesToPlace` 6, `benchSize` 3, `pointsToWin` 4.

**Arena** (`arena.ts`) — árbitro puro sobre `SimState` (no usa el store, que está atado a las
constantes globales):

```ts
export interface ArenaGameResult { winner: Player | null; plies: number; scores: Record<Player, number>; illegalAction?: string }
export function playArenaGame(white: ComputerPlayer, black: ComputerPlayer, variant: RuleVariant, seed: number, maxPlies = 400): ArenaGameResult;
export function runArena(a: (rng: Rng) => ComputerPlayer, b: (rng: Rng) => ComputerPlayer, variant: RuleVariant, games: number, seed: number): { aWins: number; bWins: number; draws: number; illegal: number };
```

- Setup en ALTERNATING: turnos alternados pidiendo `chooseSetupPlacement` / `chooseBenchType` con
  `BotContext` (usar `PlayerState` reales para contadores); validar cada colocación con
  `getBenchPlacementSquares(…, rules)` y `isCompositionFeasible`; inválida → `illegalAction` y fin.
- Juego: `choosePlayAction`; `move` debe estar en `generateMoves`; `bench` se aplica con
  `applySimBench` (lanza si es ilegal → `illegalAction`); `pass` solo válido si no hay acciones;
  auto-pase y fin por bloqueo mutuo igual que `resolveStalledTurn`.
- `runArena` alterna colores y usa `seed + i`.

**Tests:**
- `variants.test.ts`: para cada variante, `runArena(Medium, Easy, 4 partidas)` → `illegal === 0` y
  sin excepciones; `runArena(Medium, Easy, 10)` en variantes → `aWins ≥ 6` (detrás de
  `TRYMATE_ARENA`). Timeout `{ timeout: 180_000 }`.
- `arena.test.ts` (reglas actuales): 10 partidas → `aWins ≥ 7` (timeout 120 s); versión
  `TRYMATE_ARENA` con 40 → `aWins ≥ 30` (timeout 600 s). Determinista por semilla.
- `tactics.current-rules.test.ts`: **escenarios escritos para las reglas actuales**. Al inicio:

```ts
const EXPECTED_FINGERPRINT = "<valor de rulesFingerprint(CURRENT_RULES, PIECE_MOVEMENT_CONFIG) al escribir el test>";
const rulesChanged = rulesFingerprint(CURRENT_RULES, PIECE_MOVEMENT_CONFIG) !== EXPECTED_FINGERPRINT;
if (rulesChanged) console.warn("[tactics] Las reglas cambiaron: revisar y re-anclar estos escenarios.");
describe.skipIf(rulesChanged)("Medium tactics (reglas actuales)", () => { ... });
```

  Escenarios: frena corredor (y `lastDecision.posture === "DEFEND"`), tapona PIONEER, no cuelga,
  captura indefensa, avanza en bloque (no estira al líder aislado), anota para ganar.
- `perf.test.ts`: 20 posiciones de una partida de arena (reglas actuales); p95 de
  `choosePlayAction` < 400 ms (assert) y log del p95 (objetivo local < 150 ms). Repetir sobre
  `wide-7x13` solo con log (sin assert).

## Fuera de Alcance

- Web Worker, nivel Hard, tuning por variante.

## Verificación

- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai`
- [ ] `TRYMATE_ARENA=1 pnpm exec vitest run apps/web/src/lab/trymate/application/ai/arena.test.ts apps/web/src/lab/trymate/application/ai/variants.test.ts`
- [ ] Si un umbral no se alcanza: ajustar solo `medium/config.ts` con ayuda de `explainEvaluation`.

## Handoff

- Produce: red de seguridad para cambiar reglas del juego con confianza.

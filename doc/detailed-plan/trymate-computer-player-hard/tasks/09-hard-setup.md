# Task 09: Setup Hard por muestreo de ejércitos

> Parte del plan: `../plan.md` — ver tabla "Qué agrega Hard" (Setup).

## Skill / Capa

Application pura (`ai/hard/`).

## Objetivo

Elegir el despliegue comparando varios ejércitos candidatos con búsqueda corta, en vez de
colocar pieza por pieza con reglas fijas. Agnóstico de reglas. En HIDDEN no ve al rival.

## Depende De

- Task 06 (`searchHard`), Task 07 (protocolo del worker: request `setup`). De Medium: `chooseSetupPlacement` (greedy), `targetComposition`.
  Del plan Easy agnóstico: `generateRandomArmy`, `feasibleTypes`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/setup.ts` — crear (+ test).

## Detalles de Implementación

```ts
export interface ArmyPlan {
  boardPieces: { type: PieceType; position: Position }[];
  benchPieces: PieceType[];
}
export function planHardArmy(
  ctx: BotContext,
  insight: RulesInsight,
  profile: PersonalityProfile,
  rng: Rng,
  budget?: { candidates: number; nodesPerEval: number },
): ArmyPlan;
export function nextFromPlan(
  ctx: BotContext,
  plan: ArmyPlan,
): { type: PieceType; position: Position } | null;
export function nextBenchFromPlan(ctx: BotContext, plan: ArmyPlan): PieceType | null;
```

1. **Candidatos** (default 24): 12 del greedy de Medium con ruido distinto + 12 de
   `generateRandomArmy`, todos respetando las piezas **ya colocadas** por el bot (completar el resto).
2. **Oponentes de prueba:** en ALTERNATING, las piezas rivales visibles completadas con
   `generateRandomArmy` (3 variantes); en HIDDEN (tablero filtrado) 3 ejércitos rivales de
   `generateRandomArmy` + 1 greedy de Medium.
   2b. **Personalidad** (`profile.setup`, Task 05): los candidatos greedy se generan con
   `targetComposition` sesgado por `roleTilt` (sumar/restar piezas por rol del perfil, redondeo y
   luego `feasibleTypes` para mantener validez) y el puntaje final suma
   `frontBias × (piezas en la mitad delantera de las filas de despliegue)`.
3. **Puntaje de un candidato:** promedio sobre oponentes de `searchHard` a `{ kind: "nodes", n: nodesPerEval }`
   (default 3 000) desde la posición inicial resultante, con el rival moviendo primero si
   corresponde por color. Elegir el mejor (desempate `rng`).
4. En ALTERNATING re-planificar cada vez que el rival coloca algo nuevo (comparar cantidad de
   piezas rivales visibles con la del último plan) conservando lo ya colocado.
5. Se ejecuta **en el worker**: agregar al protocolo (Task 07) un request `{ kind: "setup", … }`
   con el tablero observable y las piezas ya colocadas; responde un `ArmyPlan` serializado.
   `HardBot.prepareSetupAsync` (Task 11) lo pide cuando no hay plan o el rival colocó algo nuevo.
   Presupuesto ≤ ~1.5 s en worker; en inline `candidates: 8, nodesPerEval: 800`.

## Fuera de Alcance

- Integración (Task 11).

## Verificación

- [ ] Con la misma semilla, `offensive` produce en promedio (50 planes) más piezas en filas delanteras
      y más corredores que `defensive`; `defensive`, más bloqueadores.

- [ ] Siempre produce ejércitos válidos (`isCompositionFeasible`, filas, `maxPerRow`) en las 5 variantes.
- [ ] HIDDEN vía store: con `rng` fijo, mismo plan haya o no piezas rivales colocadas.
- [ ] Mini-arena (modo nodos): ejército Hard vs ejército greedy Medium con el **mismo** motor de
      juego (Medium vs Medium) → el lado con setup Hard gana ≥ 55 % en 20 partidas (log si no; no bloqueante).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard` + `pnpm typecheck`

## Handoff

- Produce: `planHardArmy`, `nextFromPlan`, `nextBenchFromPlan`.

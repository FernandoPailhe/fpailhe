# Task 09: Bajada de banca inteligente

> Parte del plan: `../plan.md` — ver "Posturas, búsqueda, banca y despliegue".

## Skill / Capa

Application pura.

## Objetivo

Elegir qué pieza de banca bajar y dónde, maximizando la evaluación (reforzar el bloque,
taponar, cubrir piezas atacadas). Casillas válidas siempre desde las reglas.

## Depende De

- Task 03 (`applySimBench`, `SimState`), Task 06 (`evaluate`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/medium/benchPlacement.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/benchPlacement.test.ts` — crear.

## Detalles de Implementación

```ts
export function chooseBenchPlacement(
  state: SimState, bot: Player, benchPieces: GamePiece[], engine: MovementRuleEngine,
  insight: RulesInsight, weights: TermWeights, rng: Rng,
): { benchPieceId: string; to: Position } | null;
```

- `null` si `state.bench[bot].length === 0`, si el bot ya tiene ≥ `state.rules.piecesToPlace`
  piezas en tablero, o si no hay casillas (`getBenchPlacementSquares(board, bot, state.rules)`).
- Candidatos: un id por **tipo distinto** en `benchPieces` × cada casilla. Para cada uno,
  `applySimBench(state, type, square, id)` y `evaluate`. Mejor puntaje; empates (±0.5) con `rng`.
- Siempre se baja si se puede (es gratis); la búsqueda de movimiento ocurre en la siguiente
  llamada del bot.

## Fuera de Alcance

- Simular bajadas del rival.

## Verificación

- [ ] Reglas actuales: con pieza propia atacada en la zona de despliegue y un FORT en banca, lo
      baja donde la defiende; con un PIONEER rival entrando a la zona, lo tapona si puede.
- [ ] Variante con `placementRows` de profundidad 2: nunca propone casillas fuera de esas filas.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/medium` + `pnpm typecheck`

## Handoff

- Produce: `chooseBenchPlacement` para la fachada (Task 11).

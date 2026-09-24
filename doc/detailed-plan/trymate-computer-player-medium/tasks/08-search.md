# Task 08: Búsqueda alfa-beta

> Parte del plan: `../plan.md` — ver "Posturas, búsqueda, banca y despliegue".

## Skill / Capa

Application pura.

## Objetivo

Elegir la jugada considerando la mejor respuesta del rival (profundidad 2; 3 en finales), con
presupuesto de nodos y algo de variedad. La búsqueda solo conoce reglas vía `SimState` + motor.

## Depende De

- Task 03 (`generateMoves`, `applySimMove`, `passTurn`), Task 06 (`evaluate`, config), Task 07 (`TermWeights`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/medium/search.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/search.test.ts` — crear.

## Detalles de Implementación

```ts
export interface SearchResult { move: SimMove | null; score: number; depth: number; nodes: number; ranked: { move: SimMove; score: number }[] }
export function searchBestMove(root: SimState, bot: Player, engine: MovementRuleEngine, insight: RulesInsight, weights: TermWeights, rng: Rng, cfg = MEDIUM_BOT_CONFIG.search): SearchResult;
export function orderMoves(moves: SimMove[], insight: RulesInsight): SimMove[];
```

1. **Negamax alfa-beta.** Hoja = `evaluate(state, bot, …) × (state.current === bot ? 1 : −1)`.
   Terminal (`winner`) → hoja, ± `depthLeft` (ganar antes / perder después).
2. **Sin jugadas:** recursión con `passTurn` y `depthLeft − 1`.
3. **Orden:** `scores` primero; capturas por `profile.value` de la víctima desc; luego mayor
   aumento de `insight.progress`. Orden estable.
4. **Profundidad:** `target = piezasEnTablero ≤ insight.geometry.endgamePieces ? cfg.endgameDepth : cfg.depth`.
   Iterative deepening 1..target; si se supera `nodeBudget`, abortar y usar la última completa.
5. **Raíz:** ventana completa entre hermanos para puntuar cada jugada (`ranked`).
6. **Elección:** con prob. `blunderChance` y ≥ 2 jugadas → la segunda; si no, al azar entre las de
   `score ≥ best − tolerance`. Sin tolerancia si la mejor gana (`score ≥ winValue / 2`).
7. `move: null` solo si la raíz no tiene jugadas.

## Fuera de Alcance

- Banca (Task 09), postura (se recibe `weights`).

## Verificación

Escenarios de reglas actuales (`rng` que evita blunder):
- [ ] Anota para ganar con 2 puntos y pieza a 1 de la meta.
- [ ] Frena corredor: STRIKER rival a 2 de anotar → controla o captura su avance.
- [ ] No cuelga: prefiere avanzar a casilla segura sobre una atacada sin defensa.
- [ ] Captura una pieza indefensa.
- [ ] Presupuesto: con `nodeBudget: 50` devuelve jugada válida y `depth ≥ 1`.
- [ ] Determinismo con mismo `rng`.
Variante 7×13 + motor alterado:
- [ ] Devuelve solo jugadas presentes en `generateMoves` y no lanza.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/medium` + `pnpm typecheck`

## Handoff

- Produce: `searchBestMove` para la fachada (Task 11).

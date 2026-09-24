# Task 10: Despliegue y banca generados (sin coordenadas fijas)

> Parte del plan: `../plan.md` — ver "Posturas, búsqueda, banca y despliegue" (Despliegue).

## Skill / Capa

Application pura.

## Objetivo

Que el bot Medium arme su ejército con reglas de rol (bloqueadores adelante cubriendo carriles,
atacantes defendiendo, corredores en el carril más abierto) y que, cuando ve al rival
(ALTERNATING), lo contrarreste con `matchup`. Funciona con cualquier tamaño, filas o tipos.
En HIDDEN nunca usa información del rival.

## Depende De

- Task 04 (`RulesInsight`: perfiles, roles, `matchup`), Task 05 (`analyzeBoard`).
- Task 02 (`feasibleTypes`, `getBenchPlacementSquares` con `rules`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/medium/setupStrategy.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/setupStrategy.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/medium/config.ts` — agregar `SETUP_WEIGHTS`.

## Detalles de Implementación

```ts
export function targetComposition(insight: RulesInsight): Record<PieceType, number>;
export function chooseSetupPlacement(ctx: BotContext, insight: RulesInsight): { type: PieceType; position: Position } | null;
export function chooseBenchType(ctx: BotContext, insight: RulesInsight, target: Record<PieceType, number>): PieceType | null;
```

**Composición objetivo** (`targetComposition`): total `N = piecesToPlace + benchSize`.
Empezar con `minPerType` por tipo; repartir el resto proporcional a `profile.value`
(redondeo por mayor resto), sin superar `maxPerType`. Las primeras `piecesToPlace` del
despliegue buscan la misma proporción.

**Colocación** (`chooseSetupPlacement`). Candidatos: `feasibleTypes(counts, slotsRestantes, rules)` ×
`getBenchPlacementSquares(ctx.board, ctx.bot, ctx.rules)`. Para cada candidato, en un clon del
tablero con la pieza puesta, `A = analyzeBoard(clon, …)`, y `depthIdx` = posición de la fila
dentro de `placementRows` contada desde la fila base (0 = más atrás, `D − 1` = frontal):

| Regla (config `SETUP_WEIGHTS`) | Puntos |
| --- | --- |
| Tipo por debajo de su objetivo | +12 (si ya lo alcanzó: −12) |
| Rol `blocker`: `depthIdx` alto | +10 × `depthIdx / (D − 1)` |
| Cobertura: columnas de la fila inmediatamente delante de la zona propia que quedan atacadas o bloqueadas por el bot (conteo nuevo que aporta el candidato) | +6 por columna |
| Pieza nueva defendida por otra propia (`A.isDefended`) | +8 |
| Pieza nueva que defiende a otra propia | +6 |
| Rol `runner`: columna con menos rivales visibles en `±laneWindow` | +8 (empate: la más cercana al centro) |
| Rol `runner` sin `attacker`: `depthIdx` bajo | +4 × `(1 − depthIdx / (D − 1))` |
| Contra-pick: Σ sobre rivales visibles en `|dx| ≤ laneWindow + 1` de `matchup(tipo, rival.type)` | +10 × suma |
| Queda atacada por un rival visible sin defensa | −15 |
| Ruido | `rng() × 2` |

Con `D = placementRows.length`; si `D = 1`, `depthIdx / (D − 1)` = 1.
En HIDDEN el tablero ya viene filtrado: los términos "rival" valen 0 solos.

**Banca** (`chooseBenchType`):
1. `candidatos = feasibleTypes(counts, slotsRestantes, rules)` (garantiza mínimos).
2. ALTERNATING: puntaje = Σ `matchup(t, r.type)` sobre piezas rivales **en el tablero** +
   0.5 si `counts[t] < target[t]`. HIDDEN: solo el término de objetivo. Empate → mayor `value`.

## Fuera de Alcance

- Quick start (sigue igual). Coordenadas o formaciones escritas a mano.

## Verificación

- [ ] Reglas actuales (escenario): con STRIKER rival en columna 2, el primer FORT no va a la 2;
      con PIONEER rival en columna 0, alguna pieza cubre la fila frontal de esa columna.
- [ ] Reglas actuales: 5 colocaciones + 3 de banca pasan las validaciones del store.
- [ ] Variantes (7×13; profundidad de despliegue 2; `minPerType 3` con 9 piezas): despliegue
      completo válido según `rules` y `isCompositionFeasible`, sin excepciones.
- [ ] HIDDEN vía `runBotTurn` (store): con `rng` fijo, el despliegue del bot es idéntico haya o no
      piezas rivales colocadas (el store filtra el tablero antes de llamar al bot).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/medium` + `pnpm typecheck`

## Handoff

- Produce: `targetComposition`, `chooseSetupPlacement`, `chooseBenchType` para Task 11.

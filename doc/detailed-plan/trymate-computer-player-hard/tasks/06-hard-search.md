# Task 06: Búsqueda Hard (PVS + TT + quiescence + banca)

> Parte del plan: `../plan.md` — ver "Búsqueda Hard (resumen)" y "Contratos compartidos".

## Skill / Capa

Application pura (`application/ai/hard/`).

## Objetivo

El motor de decisión del nivel Hard, determinista en modo nodos y acotado por tiempo en
producción. Devuelve la secuencia de acciones del turno (bajadas + movimiento).

## Depende De

- Task 03 (`SearchBoard.hash`, TT), Task 04 (`evaluateHard`, `staticExchange`), Task 05
  (`PersonalityProfile`). De Medium:
  `choosePosture`, `weightsFor`.

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/search.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/search.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/config.ts` — crear.

## Detalles de Implementación

`config.ts`:

```ts
export const HARD_BOT_CONFIG = {
  budget: { kind: "time", ms: 800 } as SearchBudget,
  fallbackBudget: { kind: "nodes", n: 60_000 } as SearchBudget, // sin worker
  maxDepth: 12,
  aspiration: 50,
  benchTopK: 3,
  qMaxPlies: 6,
  lmr: { minDepth: 3, minIndex: 4 },
  killersPerPly: 2,
  clockCheckEvery: 1024,
  tieWindow: 1,
} as const;
```

```ts
export function searchHard(
  root: SearchBoard,
  bot: Player,
  insight: RulesInsight,
  weights: Record<HardTerm, number>,
  profile: PersonalityProfile,
  budget: SearchBudget,
  rng: Rng,
  tt?: TranspositionTable,
): HardSearchResult;
```

Algoritmo:

1. **Postura** una vez en la raíz con los umbrales de la personalidad → `postureMul`. Extender
   `choosePosture` de Medium con un parámetro opcional (sin cambiar su default):
   `overrides?: { defendZone?: number; attackZone?: number; attackMaterialLeadRatio?: number }`,
   y pasar `defendZone = runnerZone + profile.posture.defendZoneDelta`,
   `attackZone = runnerZone + 1 + profile.posture.attackZoneDelta`,
   `attackMaterialLeadRatio = profile.posture.attackMaterialLeadRatio`.
   Toda evaluación usa `evaluateHard(…, postureMul, { selfMul: profile.selfMul, oppMul: profile.oppMul }, profile.contempt)`.
2. **Iterative deepening** d = 1..maxDepth; desde d ≥ 3 ventana de aspiración ±`aspiration`
   alrededor del resultado previo (re-buscar con ventana completa si falla).
3. **Negamax PVS** `search(d, α, β, ply)`:
   - Terminal/`winner` → puntaje de victoria ajustado por ply.
   - Probe TT; si `entry.depth ≥ d` y la cota lo permite → cortar.
   - `d ≤ 0` → `quiesce(α, β, ply)`.
   - Acciones: si `current` puede bajar banca y quedan bajadas en este turno → las `benchTopK`
     mejores bajadas por `evaluateHard` estático, **más** los movimientos normales. Una bajada
     hace `make` y recursa con **la misma** `d`, mismo lado (negamax sin cambio de signo).
     Limitar a `rules.benchSize` bajadas seguidas por turno (contador en la pila).
   - Sin acciones → pase: `current` alterna, recursa con `d − 1`.
   - Orden: TT best → anotación → capturas SEE ≥ 0 por MVV-LVA → killers(ply) → history[from→to] → bajadas → resto.
   - Primera acción ventana completa; resto ventana nula (PVS) y re-búsqueda si mejora.
   - **LMR** para movimientos tardíos sin captura/anotación según `lmr`.
   - **Extensión** +1 si tras la acción el rival de `current` tiene una pieza con
     `distToGoal ≤ 1` sin controlar (una sola vez por rama).
   - Guardar en TT; actualizar killers/history en cortes β.
4. **Quiescence:** stand-pat = `evaluateHard`; acciones = anotaciones, capturas con SEE ≥ 0,
   avances a `distToGoal ≤ 1`; máx `qMaxPlies`.
5. **Presupuesto:** contador de nodos; en modo tiempo mirar `performance.now()` cada
   `clockCheckEvery` nodos; al exceder, abortar (excepción interna) y devolver la última
   iteración completa. Siempre completar al menos d = 1.
6. **Resultado:** `pv` desde la TT; `actions` = prefijo de la PV hasta el primer movimiento
   (incluye bajadas previas).
   **Desempate por estilo:** candidatas = acciones raíz con `score ≥ best − profile.tieWindow`
   (nunca aplicar si `best ≥ winValue / 2`). `tieBreak = "progress"` → mayor aumento de progreso
   propio tras la acción; `"safety"` → menos piezas propias atacadas tras la acción; `"none"` → `rng`.
   Empates restantes → `rng`. Guardar en el resultado `styleApplied: boolean` para métricas.
7. No usar `Date.now()` en modo nodos (determinismo).

## Fuera de Alcance

- Worker (Task 07), setup (Task 09).

## Verificación

Modo `{ kind: "nodes" }` en todos los tests:

- [ ] Tácticas de Medium (reutilizar escenarios) todas verdes.
- [ ] **Combinación de 2 jugadas:** posición donde el único camino a anotar requiere primero
      capturar un defensor → la encuentra a d ≥ 3.
- [ ] **Horizonte:** captura que parece buena pero pierde la pieza en la recaptura → no la juega (quiescence).
- [ ] **Banca:** bajar una pieza que tapona al corredor rival antes de mover → `actions[0].kind === "bench"`.
- [ ] Determinismo: misma posición + seed + nodos + personalidad → mismo resultado.
- [ ] Personalidad: en una posición con "avanzar corredor" vs "cerrar el bloque" casi empatadas,
      `offensive` elige avanzar y `defensive` cerrar; `balanced` elige la de mayor score.
- [ ] Contempt: posición de bloqueo mutuo alcanzable → `offensive` la evita si tiene alternativa
      ≥ −60; `defensive` la acepta cuando va perdiendo.
- [ ] Con TT vs sin TT → mismo `score` en 20 posiciones (a igual profundidad), menos nodos con TT.
- [ ] Variantes (`ruleVariants`): solo acciones legales, sin excepciones.
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard` + `pnpm typecheck`

## Handoff

- Produce: `searchHard` (con `profile`), `HARD_BOT_CONFIG` para Tasks 07, 09, 10, 11.

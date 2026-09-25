# Task 13: Arena, tácticas profundas, variantes y rendimiento

> Parte del plan: `../plan.md` — ver "Criterios de Aceptación Globales".

## Skill / Capa

Tests vitest sobre `application/ai/` (arena y variantes del plan Easy agnóstico / Medium).

## Objetivo

Demostrar que Hard es claramente más fuerte que Medium, que ve combinaciones que Medium no ve,
que sigue siendo legal con otras reglas y que respeta su presupuesto de tiempo.

## Depende De

- Task 11 (HardBot), Task 10 (pesos ajustados; correr el tuning completo antes de fijar umbrales), Task 05 (personalidades).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/application/ai/hard/arena.hard.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/tactics.current-rules.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/variants.hard.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/personalities.hard.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/hard/perf.hard.test.ts` — crear.
- `apps/web/src/lab/trymate/application/ai/arena.ts` — editar si hace falta soportar bots async
  (usar `choosePlayActionAsync` con `forceInline` y presupuesto de nodos) y para devolver
  métricas de estilo por bando (ver `personalities.hard.test.ts`).

## Detalles de Implementación

- **Modo determinista en todo test:** crear Hard con override `budget: { kind: "nodes", n: 20_000 }`
  y `HardBotClient({ forceInline: true })`. Exponer esa opción en `createHardBot(rng, overrides?)`.
- `arena.hard.test.ts`:
  - CI: Hard vs Medium 10 partidas → Hard ≥ 7 (timeout 300 s).
  - `TRYMATE_ARENA=1`: Hard vs Medium 40 → ≥ 28; Hard vs Easy 20 → ≥ 18 (timeout 1 800 s).
- `tactics.current-rules.test.ts` (patrón fingerprint + `describe.skipIf` como en Medium):
  1. Todas las tácticas de Medium.
  2. **Capturar al defensor para anotar** (2 jugadas propias).
  3. **Horizonte:** no captura si pierde la pieza en la recaptura.
  4. **Carrera ganada:** con corredor imparable, prioriza avanzarlo aunque haya una captura menor disponible.
  5. **Carrera perdida:** frena al corredor rival imparable aunque sacrifique progreso propio.
  6. **Banca que tapona:** baja una pieza que bloquea al corredor rival antes de mover.
  7. **Sacrificio para abrir carril:** entrega una pieza de menor valor para liberar un corredor que anota.
     Para cada uno comparar además con Medium (log): documentar cuáles Medium falla (esperable).
- `personalities.hard.test.ts` (nuevo archivo):
  - **Métricas de estilo** (`arena.ts` debe devolver por partida y bando): `avgFrontProgress`
    (progreso medio de la pieza más adelantada por turno), `pliesToFirstScore`,
    `capturesMade`, `piecesLost`, `opponentMaxProgress`, `endedByBlock`.
  - Cada personalidad vs Medium en 10 partidas (CI) → ≥ 6 victorias cada una (sigue siendo Hard).
  - **Paridad** (`TRYMATE_ARENA=1`): cada personalidad vs `balanced` en 40 partidas → entre 40 % y 60 %.
  - **Estilo** (mismas semillas, vs Medium, 20 partidas): `offensive.avgFrontProgress > balanced > defensive`
    y `offensive.pliesToFirstScore < defensive.pliesToFirstScore`; `defensive.opponentMaxProgress <
offensive.opponentMaxProgress` y `defensive.piecesLost ≤ offensive.piecesLost`.
    Loguear la tabla completa de métricas por personalidad (sirve de referencia para el plan de datos).
- `variants.hard.test.ts`: cada variante de `ruleVariants`, Hard vs Medium 4 partidas → 0 ilegales;
  `TRYMATE_ARENA=1`: 10 partidas → Hard ≥ 6.
- `perf.hard.test.ts`: con `{ kind: "time", ms: 300 }` inline en 10 posiciones: cada decisión
  termina en ≤ 300 + 150 ms (margen jsdom) y alcanza `depth ≥ 3` en posiciones de mitad de partida
  (log de depth/nodos/ms para seguimiento).

## Fuera de Alcance

- Ajustar pesos a mano para pasar tests: si faltan victorias, re-correr Task 10 o revisar la búsqueda.

## Verificación

- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard`
- [ ] `TRYMATE_ARENA=1 pnpm exec vitest run apps/web/src/lab/trymate/application/ai/hard`

## Handoff

- Produce: evidencia de nivel y red de seguridad para futuros cambios.

---

## Resultados medidos (implementación)

Estado final de los gates, tras calibración SPSA + fixes de evaluación:

| Test                                 | Umbral spec       | Medido              | Estado                                                              |
| ------------------------------------ | ----------------- | ------------------- | ------------------------------------------------------------------- |
| Tácticas profundas (11)              | pasan             | 11/11               | ✅                                                                  |
| Perf 300 ms inline                   | ≤450 ms, depth ≥3 | ~300 ms, depth 4–11 | ✅                                                                  |
| CI arena vs Medium (10)              | ≥7                | 7–3–0               | ✅                                                                  |
| CI personalidades vs Medium (10 c/u) | ≥6                | 6/8/8               | ✅                                                                  |
| CI variantes (4 c/u)                 | 0 ilegales        | 0 en las 5          | ✅                                                                  |
| Larga vs Easy (20)                   | ≥18               | 20–0–0              | ✅                                                                  |
| Larga vs Medium (40)                 | ≥28               | 23–15–2 (~58%)      | ⚠️ no alcanza                                                       |
| Larga variantes (10 c/u)             | ≥6                | 7/6/6/3/4           | ⚠️ 3/5 (altered-moves, more-pieces requieren tuning por variante)   |
| Paridad offensive vs balanced        | 40–60%            | ~65%                | ⚠️ offensive es el más fuerte                                       |
| Paridad defensive vs balanced        | 40–60%            | 40–55%              | ✅ borde                                                            |
| Estilo (métricas)                    | orden estricto    | parcial             | ⚠️ bal>def front y def.oppMax<off no se sostienen en muestras de 20 |

**Personalidades — decisión final:** se probó suavizar los multiplicadores ~40%
hacia neutro para acercar paridad (offensive bajó a 63%, defensive subió a 55%),
pero offensive dejó de cumplir el gate CI de fuerza (4–4–2 <6) sin cerrar la
paridad. Se restauraron los multiplicadores originales (CI 6/8/8 ✅) y la
paridad/orden de estilo quedan documentados como gaps — diferenciar estilo sin
perder fuerza es la tensión inherente del diseño.

**Por qué no llega al 70%:** Hard comparte la familia de evaluación de Medium
(mismos términos base) y agrega `see`/`race` con búsqueda 2–3× más profunda. La
tasa real medida vs Medium es ~58–63% (30 juegos pareados: 17–12–1 con pesos
tuned). La profundidad no escala el win-rate (2k ≈ 5k ≈ 20k nodos): el juego es
de carreras y bloqueos donde las tácticas decisivas son mayormente superficiales
y Medium ya las encuentra a profundidad 2–3.

**Fixes reales encontrados en el camino:**

- `search.ts`: cotas de ventana nula PVS contaminaban el desempate raíz
  (re-verificación con ventana abierta); unmake omitido tras abort.
- `race.ts`: el DFS del "catcher" solo veía movimientos — ahora modela drops de
  banca al camino del corredor (firme → caught; solo retraso si el tapón es
  capturable-avanzando).
- `botAction.ts`: colisión de ids de banca al mapear secuencias [bench,move].
- `config.ts`: `clockCheckEvery` 1024→64 (overshoot de presupuesto de tiempo);
  re-verificación de raíz ahora budget-aware.
- Setup planning: con presupuesto bajo (4×200) era NET-negativo (53% vs 67%
  greedy en pareadas); con ≥8×1500 empata al greedy. `TEST_SETUP` subido.
- `weights.ts`: fallback stale ahora devuelve los pesos tuned (agnósticos de
  reglas) en vez de neutros — mejora variantes cercanas.

**Pendiente si se retoma:** tuning SPSA por variante (weights.json ligado a
fingerprint), SPSA a escala del spec (200 iters), o nueva familia de evaluación
para superar el techo ~65%.

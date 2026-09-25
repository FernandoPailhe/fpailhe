---
name: trymate-selfplay
description: >
  Laboratorio de auto-juego y estadísticas de TryMate: runner de Node con worker_threads que juega
  partidas bot-vs-bot, formato de datos versionado (trymate.game/1, jsonl.gz + manifest), experimentos
  JSON con variantes de reglas, agregación (summary.json), reportes (report.md), comparación de
  batches con intervalos de confianza y consultas DuckDB. Usar al crear/modificar código en
  lab/trymate/selfplay/**, agregar métricas o experimentos, cambiar el esquema de datos, correr o
  analizar batches, o evaluar un cambio de reglas con datos. Triggers: "selfplay", "auto-juego",
  "estadísticas de partidas", "experimento", "batch", "trymate:selfplay", "trymate:report",
  "trymate:compare", "balance del juego", "ventaja de blancas", "dataset", "DuckDB".
triggers:
  - user
  - model
---

# TryMate — Auto-juego y estadísticas

> Plan de origen: `doc/detailed-plan/trymate-selfplay-stats/` (seguir sus tasks en orden).
> Reglas/motor: skill `trymate-rules-agnostic`. Bots: skill `trymate-computer-player`.

## Estado

Planificado. Precondiciones ya implementadas: `SimState`, `arena.ts`, `ruleVariants`,
`ComputerPlayer`, `generateRandomArmy`, `feasibleTypes`, `buildRulesView`, motor configurable.
Medium/Hard son opcionales: el runner usa los bots registrados; presets con `hard` fallan con
mensaje claro hasta que exista. **Verificar contra el código** antes de asumir un nombre.

## Arquitectura

```
apps/web/src/lab/trymate/selfplay/
  core/         # TS puro (sin Node ni DOM): record, positionCodec, playRecordedGame, metrics,
                #   replay, experiment, ruleOverrides, stats, aggregate, renderReport, compare
  node/         # cli.ts, pool.ts, worker.ts, shardWriter.ts, manifest.ts, readBatch.ts
  experiments/  # presets JSON (smoke, balance-*, personalities-matrix, rules-*, setup-modes)
  duckdb/       # README, views.sql, queries.sql
  README.md     # uso + tabla de rendimiento medido en la Mac mini
```

- **Aislado del bundle web:** nada fuera de `selfplay/` lo importa (test `selfplayIsolation.test.ts`).
- `node/` excluido de `apps/web/tsconfig.json`; tipado con `apps/web/tsconfig.selfplay.json` (`types: ["node"]`).
- **Build/ejecución:** Vite en modo SSR (`apps/web/vite.selfplay.config.ts` → `apps/web/.selfplay-dist/`,
  gitignored) y `node`. No agregar `tsx`/`ts-node`/librerías de CLI (usar `node:util parseArgs`).
- `core/` puede importar constantes de reglas (no está bajo el lint de `ai/**`), pero **los bots**
  siguen recibiendo reglas solo por `BotContext`.

## Comandos (raíz)

```bash
pnpm trymate:selfplay --config apps/web/src/lab/trymate/selfplay/experiments/<preset>.json [--out DIR] [--games N] [--workers N] [--resume BATCH_DIR] [--no-positions] [--report]
pnpm trymate:report  <batchDir…>            # summary.json + report.md (varios dirs = agregados juntos)
pnpm trymate:compare <batchA> <batchB> [--by variant|matchup|all]
pnpm trymate:validate <batchDir>            # esquema de todas las líneas + replay de una muestra
```

Datos por defecto en `~/TryMateData/selfplay/` (o `TRYMATE_DATA_DIR` / `--out`, ej. disco externo).
**Nunca** escribir datos dentro del repo ni commitearlos.

## Formato de datos (contrato)

- Batch: `<YYYYMMDD-HHmm>-<name>-<hex>/` con `manifest.json` (`trymate.batch/1`: config, git sha,
  fingerprints, bots, máquina, estado `running|completed|interrupted`, contadores),
  `games-NNN.jsonl.gz` (1 000 partidas por shard), `failures.jsonl`, `summary.json`, `report.md`.
- Partida `trymate.game/1`: `rules` (fingerprint, variante, snapshot de `RulesView`, config de
  piezas), `players` (bot, dificultad, personalidad, presupuesto, `configHash`), `setupMode`
  (`ALTERNATING|HIDDEN|RANDOM`), `setup`, `opening` (plies aleatorios), `plies[]` (acción,
  captura, anotación, `decision` del bot, `pos` compacta antes de la acción), `result`, `metrics`.
- **Versionado:** cambio compatible (campo opcional nuevo) → misma versión; cambio incompatible →
  `trymate.game/2` + lector que soporte ambas. Nunca reinterpretar un campo existente.
- `pos` (`positionCodec`) es independiente del tamaño de tablero y de los tipos (índices sobre
  `rules.pieceTypes`); se guarda por defecto porque habilita entrenar una red (opción 2) sin re-jugar.

## Reglas de oro

1. **Determinismo:** misma config + seed → mismos registros (salvo tiempos). Rngs derivados por
   jugador y apertura; presupuestos de búsqueda **por nodos**, nunca por tiempo.
2. **Diversidad:** semilla por partida, `setupMode` sorteado, apertura con `epsilon` (jugadas marcadas
   `random: true`). Vigilar `duplicates` y `randomOpeningShare` en el summary.
3. **Integridad:** toda partida guardada debe pasar `validateGameRecord` y `replayGame`. Una acción
   ilegal no se guarda como partida: va a `failures.jsonl`.
4. **Reanudable e idempotente:** ids estables (`<batchId>-<i>`), `--resume` saltea ids existentes.
5. **Streaming:** agregar sin cargar el batch en memoria (acumuladores incrementales).
6. **Estadística honesta:** mostrar `n`; ⚠ si `n < 200`; proporciones con Wilson 95 %; "significativo"
   solo si los IC no se solapan (medias: |Δ| > 2·SE). No sacar conclusiones de diseño con ⚠.
7. **Reglas en datos:** comparar solo batches con el mismo fingerprint, salvo que el objetivo sea
   justamente comparar reglas (el reporte lo advierte).

## Recetas

**Nueva métrica:** agregar el campo al acumulador en `core/aggregate.ts` (+ tipo en `Summary`),
test con registros sintéticos, render en `renderReport.ts` (y en `compare.ts` si es escalar). Si
necesita datos que el registro no tiene, agregarlos como **campo opcional** del registro.

**Nuevo experimento:** copiar un preset de `experiments/`, cambiar `name`, `matchups`, `rules`
(`{ variant, board?, rules?, pieces? }` — `pieces` es parche profundo por tipo). Debe pasar
`experiments.test.ts`. Para evaluar una regla: correr `current` y la variante con los mismos bots y
semilla, luego `trymate:compare`.

**Probar un cambio de reglas antes de implementarlo en la UI:** preset `rules-*` → `--report` →
`compare` contra `balance-*` → decidir → recién ahí editar constantes (skill `trymate-rules-agnostic`).

## Checklist de revisión

- [ ] `core/` sin `node:*` ni DOM; `node/` solo I/O y orquestación.
- [ ] Guarda de aislamiento verde; bundle web sin cambios.
- [ ] Esquema: validación y replay verdes; versión respetada.
- [ ] Determinismo (`workers: 1` vs `N` mismos registros) y reanudación sin duplicados.
- [ ] Sin dependencias nuevas salvo `@types/node` (dev).
- [ ] `pnpm typecheck` (ambos tsconfig) `&& pnpm lint && pnpm test && pnpm build`.

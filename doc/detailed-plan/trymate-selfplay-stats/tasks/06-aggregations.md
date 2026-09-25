# Task 06: Agregación de estadísticas (`summary.json`)

> Parte del plan: `../plan.md` — ver "Estadísticas (qué responde el reporte)".

## Skill / Capa

`selfplay/core` (agregadores puros) + `selfplay/node` (lectura de shards).

## Objetivo

Leer un batch en streaming y producir `summary.json` con todas las métricas, agrupadas por
variante de reglas, matchup y modo de setup, con intervalos de confianza.

## Depende De

- Task 01 (tipos, `decodePosition`), Task 03 (`SideMetrics`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/core/stats.ts` — crear (+ test).
- `apps/web/src/lab/trymate/selfplay/core/aggregate.ts` — crear (+ test).
- `apps/web/src/lab/trymate/selfplay/node/readBatch.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/node/cli.ts` — subcomando `report` (parte 1: genera `summary.json`).

## Detalles de Implementación

1. `stats.ts`: `wilson(successes, n, z = 1.96): { p, lo, hi }`, `mean`, `stdev`, `percentiles(values, [10, 50, 90])`,
   `histogram(values, bins)`, `overlaps(a, b)`.
2. `aggregate.ts` — acumulador incremental (no guardar partidas en memoria):

```ts
export interface Aggregator {
  add(r: GameRecord): void;
  finish(): Summary;
}
export function createAggregator(): Aggregator;
```

Grupos: `all`, `variant` (nombre + fingerprint), `variant × matchup`, `variant × setupMode`.
Por grupo (`Summary.groups[key]`):

- `n`, `winsByColor` (+ Wilson), `draws`, `reasons` (`points|blocked|maxPlies`), `plies` (mean, p10/p50/p90, histograma).
- `firstScorerWins` (Wilson), `comebackRate`.
- `byComposition`: clave `"<tipo>:<n>,…|bench:<…>"` usando nombres de `rules.pieceTypes`;
  wins/n por bando (solo claves con n ≥ 30 en el reporte).
- `byFormation`: piezas en fila delantera/media/trasera de despliegue (relativo a `placementRows`).
- `pieces[type]`: `deployed`, `survived`, `capturesMade`, `capturesSuffered`, `pointsScored`,
  `pliesToScore` (mean), `benchDrops`.
- `captureMatrix[captor][víctima]`.
- `heatmaps` (matriz `height × width` por variante): `occupancy`, `captures`, `scoringColumns` (vector `width`).
- `bench`: bajadas por partida, ply promedio de bajada, win rate por cantidad de bajadas.
- `personalities`: matriz `[personalidadBlanca][personalidadNegra]` → wins/n; promedio de `SideMetrics` por personalidad.
- `calibration`: para plies {10, 20, 40}, bins de `decision.eval` (quintiles) → % de victoria del bando que evaluó.
- `randomOpeningShare`: fracción de plies aleatorios (control de diversidad).
- `duplicates`: cantidad de partidas con la misma secuencia de acciones (hash) — alerta de falta de diversidad.
  Para posiciones (ocupación) reconstruir con `SimState` al recorrer plies (no hace falta `pos`).

3. `Summary` = `{ schema: "trymate.summary/1", batchId, generatedAt, games, failures, groups, warnings: string[] }`;
   `warnings` incluye grupos con `n < 200`, `duplicates > 1 %`, `maxPlies > 5 %`.
4. `readBatch.ts`: iterar shards `jsonl.gz` con `readline` + `zlib.createGunzip`, validar cada línea
   con `validateGameRecord` (inválidas → contador, no cortan).
5. CLI `report <batchDir>` escribe `summary.json` (el `.md` lo agrega Task 07). Acepta varios dirs
   (`report a b c --out merged/`) para agregar batches juntos.

## Fuera de Alcance

- Texto del reporte y comparación (Task 07).

## Verificación

- [ ] Tests con 3–4 registros sintéticos a mano: conteos, matriz de capturas, heatmaps y Wilson correctos.
- [ ] `wilson(50, 100)` ≈ `{ p: 0.5, lo: 0.404, hi: 0.596 }`.
- [ ] 10 000 registros sintéticos: memoria estable (no crece con n) y < 10 s.
- [ ] Con un batch real del smoke test, `summary.json` válido y `warnings` presentes (n chico).
- [ ] `pnpm exec vitest run apps/web/src/lab/trymate/selfplay` + `pnpm typecheck`

## Handoff

- Produce: `summary.json` para Task 07 y 08.

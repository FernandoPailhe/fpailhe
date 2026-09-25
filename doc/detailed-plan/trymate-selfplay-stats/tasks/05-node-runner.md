# Task 05: Runner de Node con pool de workers (CLI `selfplay`)

> Parte del plan: `../plan.md` — ver "Dónde vive el código" y "Dónde viven los datos".

## Skill / Capa

`selfplay/node` + build. Reglas de `.devin/rules/rules.md` §9 (dependencias).

## Objetivo

Un comando que corre un experimento usando todos los núcleos, escribe shards `jsonl.gz` y un
`manifest.json`, muestra progreso, se puede interrumpir y retomar.

## Depende De

- Task 03 (`playRecordedGame`), Task 04 (`parseExperiment`, `expandGames`, `materializeSpec`).

## Archivos a Crear/Editar

- `apps/web/src/lab/trymate/selfplay/node/cli.ts` — crear (subcomandos; `report`/`compare` se completan en Tasks 06–07 y `validate` en Task 09).
- `apps/web/src/lab/trymate/selfplay/node/pool.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/node/worker.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/node/shardWriter.ts` — crear.
- `apps/web/src/lab/trymate/selfplay/node/manifest.ts` — crear.
- `apps/web/vite.selfplay.config.ts` — crear.
- `apps/web/tsconfig.json` — excluir `src/lab/trymate/selfplay/node/**`.
- `apps/web/tsconfig.selfplay.json` — crear (extiende el base, `types: ["node"]`, incluye `selfplay/**` y lo que importe).
- `apps/web/package.json` — devDependency `@types/node`; script `typecheck` corre ambos tsconfig.
- `package.json` (raíz) — scripts `trymate:*`.
- `.gitignore` — `apps/web/.selfplay-dist/`.
- `apps/web/src/lab/trymate/selfplay/selfplayIsolation.test.ts` — crear (guarda del bundle).

## Detalles de Implementación

1. **Build** (`vite.selfplay.config.ts`):

```ts
export default defineConfig({
  build: {
    ssr: true,
    target: "node20",
    outDir: ".selfplay-dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        cli: "src/lab/trymate/selfplay/node/cli.ts",
        worker: "src/lab/trymate/selfplay/node/worker.ts",
      },
      output: { format: "esm", entryFileNames: "[name].js" },
    },
  },
});
```

2. **Scripts raíz:**

```json
"trymate:build-selfplay": "pnpm build:packages && pnpm --filter @ferpa/web exec vite build -c vite.selfplay.config.ts",
"trymate:selfplay": "pnpm trymate:build-selfplay && node apps/web/.selfplay-dist/cli.js selfplay",
"trymate:report": "pnpm trymate:build-selfplay && node apps/web/.selfplay-dist/cli.js report",
"trymate:compare": "pnpm trymate:build-selfplay && node apps/web/.selfplay-dist/cli.js compare",
"trymate:validate": "pnpm trymate:build-selfplay && node apps/web/.selfplay-dist/cli.js validate"
```

3. **CLI** (`node:util` `parseArgs`, sin librerías):
   `selfplay --config <json> [--out <dir>] [--games N] [--workers N] [--resume <batchDir>] [--no-positions] [--report]`.
   - `out` default: `process.env.TRYMATE_DATA_DIR ?? ~/TryMateData/selfplay`.
   - `batchId` = `YYYYMMDD-HHmm-<name>-<4 hex>`; `gitSha` con `git rev-parse --short HEAD` (null si falla).
   - `--report` corre `report` al terminar.
4. **Pool** (`node:worker_threads`): `workers = auto → max(1, os.cpus().length − 1)`. El main
   reparte `GameSpecDescriptor`s de a uno (cola), cada worker hace `materializeSpec` +
   `playRecordedGame` y responde `{ ok, record }` o `{ ok: false, spec, error }`.
   Worker path: `new Worker(join(dirname(fileURLToPath(import.meta.url)), "worker.js"))`.
5. **ShardWriter:** un único escritor en el main; `zlib.createGzip()` → `games-NNN.jsonl.gz`,
   rota cada 1 000 partidas; fallas a `failures.jsonl`. Flush al rotar y al cerrar.
6. **Manifest** (`trymate.batch/1`): experimento completo, `batchId`, `gitSha`, `startedAt`,
   `finishedAt`, `status` (`running|completed|interrupted`), `gamesPlanned`, `gamesDone`,
   `failures`, `fingerprints` por variante, `bots` disponibles, `machine` (`os.cpus()[0].model`,
   cantidad, `process.version`), `gamesPerHour`. Se reescribe cada 30 s y al final.
7. **Progreso:** una línea cada 5 s: `1234/5000 (24.7%) · 812 g/h · ETA 4h38m · W 51.2% / B 48.1% · fails 0`.
8. **Interrupción:** `SIGINT` → dejar de repartir, esperar partidas en curso (máx 30 s), cerrar
   shard, `status: interrupted`. Segundo Ctrl+C → salir ya.
9. **Reanudar:** `--resume <dir>`: leer manifest (misma config), escanear ids en shards
   existentes (streaming con `readline` sobre `gunzip`), re-expandir y saltear ids ya hechos;
   nuevos shards continúan la numeración.
10. **Guarda de bundle** (`selfplayIsolation.test.ts`): recorrer `apps/web/src` y fallar si algún
    archivo fuera de `selfplay/` importa `selfplay/`.

## Fuera de Alcance

- Agregación y reporte (Tasks 06–07).

## Verificación

- [ ] `pnpm trymate:selfplay --config apps/web/src/lab/trymate/selfplay/experiments/smoke.json --out /tmp/tm`
      (preset de Task 08; mientras tanto un JSON local con Easy vs Easy, 40 partidas) termina y
      deja manifest `completed` + shard(s).
- [ ] Ctrl+C a mitad → `interrupted`; `--resume` completa sin duplicar ids (contar ids únicos).
- [ ] `workers: 1` vs `workers: 4` → mismos registros (ignorando tiempos), orden de shards puede variar.
- [ ] `pnpm typecheck` (ambos tsconfig), `pnpm lint`, `pnpm test`, `pnpm build` (el bundle web no cambia).

## Handoff

- Produce: comando `trymate:selfplay` y batches en disco.

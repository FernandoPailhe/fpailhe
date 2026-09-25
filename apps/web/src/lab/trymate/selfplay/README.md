# TryMate Selfplay — laboratorio de auto-juego y estadísticas

Runner de Node que juega partidas bot-vs-bot a gran escala, graba cada acción
en un formato versionado (`trymate.game/1`) y produce estadísticas agregadas
(`summary.json`), un reporte legible (`report.md`) y comparaciones entre
batches con intervalos de confianza. Sirve para medir balance de reglas,
diversidad de setups, rendimiento de bots y calibración del eval — **antes** de
cambiar reglas en la UI.

## Requisitos

- Node ≥ 20 (usa `worker_threads` y `parseArgs` de `node:util`).
- `pnpm install` en la raíz del monorepo.
- Opcional: `brew install duckdb` para explorar los datos a mano (ver `duckdb/`).

## Comandos (desde la raíz)

```bash
# Jugar un experimento
pnpm trymate:selfplay --config apps/web/src/lab/trymate/selfplay/experiments/smoke.json [--report]

# Opciones útiles de selfplay
#   --out DIR        directorio de datos (default ~/TryMateData/selfplay o TRYMATE_DATA_DIR)
#   --games N        pisa la cantidad de partidas
#   --workers N      workers (default: auto = cores-1)
#   --resume DIR     continuar un batch interrumpido (ids estables, sin duplicados)
#   --no-positions   no grabar `pos` (posición compacta antes de cada acción)
#   --report         generar summary.json + report.md al terminar

# Agregar / reportar / comparar / validar
pnpm trymate:report <batchDir…>            # summary.json + report.md (varios dirs = merge)
pnpm trymate:compare <batchA> <batchB> [--by all|variant|matchup] [--out file.md]
pnpm trymate:validate <batchDir>           # esquema de todo + replay del 5 % (mín. 20)
```

Los datos **nunca** se escriben dentro del repo: van a `~/TryMateData/selfplay/`
(o `TRYMATE_DATA_DIR` / `--out` — útil apuntar a un disco externo).

## Un ciclo típico

```bash
# 1. Smoke: verifica que todo anda (~segundos)
pnpm trymate:selfplay --config apps/web/src/lab/trymate/selfplay/experiments/smoke.json --report

# 2. Balance con el bot medio
pnpm trymate:selfplay --config .../balance-medium.json --games 300 --report

# 3. ¿Una regla nueva cambia el balance? preset rules-* → compare
pnpm trymate:compare <batchBalance> <batchRules> --by variant
```

## Formato de datos

Cada batch es un directorio `<YYYYMMDD-HHmm>-<name>-<hex>/` con:

| Archivo              | Contenido                                                        |
| -------------------- | ---------------------------------------------------------------- |
| `manifest.json`      | `trymate.batch/1`: config, git sha, fingerprints, estado, g/h    |
| `games-NNN.jsonl.gz` | partidas `trymate.game/1`, una por línea, rotación cada 1 000    |
| `failures.jsonl`     | partidas que fallaron (acción ilegal, excepción)                 |
| `summary.json`       | `trymate.summary/1`: agregados por variante/matchup/setup        |
| `report.md`          | el summary en legible (heatmaps, matriz de capturas, Wilson 95%) |

Un registro `trymate.game/1` incluye: identidad (`id`, `seed`, `gitSha`),
snapshot completo de reglas + fingerprint, specs de bots (bot, personalidad,
presupuesto, `configHash`), `setupMode`, ejércitos de setup, apertura aleatoria
marcada, `plies[]` con la acción + `decision` del bot + `pos` compacta
(codec independiente del tamaño del tablero), `result` y `metrics` por bando.

**Versionado:** campos nuevos opcionales = compatible; cambio incompatible =
`trymate.game/2` + lector dual.

## Experimentos

Los presets viven en `experiments/*.json`. Para uno nuevo, copiar un preset y
ajustar `matchups` (bot, `personality`, `budget` **por nodos** — nunca por
tiempo, para que sea determinista) y `rules` (`{ variant, board?, rules?,
pieces? }` — `pieces` es un parche profundo sobre `PIECE_MOVEMENT_CONFIG`).

Reglas imposibles (ej. no entran las piezas en el despliegue) fallan al parsear
con mensaje claro — `experiments.test.ts` cubre todos los presets.

## Reanudar

Ctrl+C cierra limpio (`status: interrupted` en el manifest, shards cerrados).
Reanudar con:

```bash
pnpm trymate:selfplay --config <mismo.json> --resume <batchDir>
```

Los ids son estables (`<batchId>-NNNNNN`): el runner relee los shards, saltea
ids existentes y continúa la numeración de shards. Mismo config + seed → mismos
registros, con cualquier cantidad de workers.

## Rendimiento medido (Mac mini / Apple M4, 9 workers)

| Matchup                 | Presupuesto  | g/h aprox  | Tamaño por partida (gz) |
| ----------------------- | ------------ | ---------- | ----------------------- |
| easy vs easy            | —            | ~1 000 000 | ~3 KB                   |
| medium vs medium        | 3 000 nodos  | ~150 000   | ~3 KB                   |
| hard vs hard (balanced) | 20 000 nodos | ~50        | ~2 KB                   |

(Los números de hard dependen fuerte del largo de la partida y la variante.)

## Estadística honesta

El reporte marca ⚠ en todo grupo con `n < 200`, adjunta IC de Wilson 95 % a las
proporciones y declara "significativa" una diferencia solo si los IC no se
solapan (o |Δ| > 2·SE para medias). No sacar conclusiones de diseño con ⚠.
`compare` advierte si las variantes de reglas difieren entre batches.

## DuckDB (opcional)

Ver `duckdb/README.md`: vistas (`games`, `plies`, `setups`) y consultas listas
sobre los shards, sin convertir nada.

## Próximos pasos

- **Opción 2 del plan**: entrenar una red de evaluación sobre `pos` + resultado
  (los registros ya guardan posiciones compactas antes de cada acción).
- Página de estadísticas con gráficos (hoy: `report.md` + heatmaps de texto).

Ver también: skill `trymate-selfplay` (reglas de oro), plan
`doc/detailed-plan/trymate-selfplay-stats/`.

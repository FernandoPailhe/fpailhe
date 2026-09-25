# Exploración de batches con DuckDB

DuckDB (gratis) lee los shards `games-*.jsonl.gz` directamente — sin importar ni
convertir nada. Sirve para consultas ad-hoc sobre un batch: balance por color,
capturas por tipo, columnas de anotación, etc.

## Instalación

```bash
brew install duckdb
```

Requiere DuckDB ≥ 0.10 (las vistas usan `SET VARIABLE` + `getvariable()`).
En versiones viejas, editar `views.sql` y reemplazar `getvariable('batch')` por
la ruta literal del batch entre comillas.

## Uso

```bash
duckdb
```

```sql
SET VARIABLE batch = '/Users/…/TryMateData/selfplay/<batchId>';
.read apps/web/src/lab/trymate/selfplay/duckdb/views.sql
SELECT * FROM games LIMIT 5;
```

Después de cargar las vistas, correr las consultas de `queries.sql` a mano
(cada una está comentada). Ejemplos rápidos:

```sql
-- ¿Ventaja de color?
SELECT variant, avg((winner='BLANCAS')::int) AS pct_b FROM games GROUP BY 1;

-- ¿Por qué terminan las partidas?
SELECT reason, count(*), avg(plies) FROM games GROUP BY 1;
```

## Vistas disponibles

| Vista    | Una fila por… | Columnas clave |
| -------- | ------------- | -------------- |
| `games`  | partida       | `variant`, `matchup`, `setupMode`, `winner`, `reason`, `plies`, `score_white/black` |
| `plies`  | acción        | `game_id`, `n`, `player`, `kind`, `from_x/y`, `to_x/y`, `capture`, `scored`, `random`, `eval`, `depth`, `nodes` |
| `setups` | pieza de setup | `game_id`, `side`, `type`, `x`, `y` |

## Exportar a CSV

```sql
COPY (SELECT * FROM games) TO '/tmp/games.csv' (HEADER);
```

El CSV abre directo en Numbers o Excel.

-- Vistas DuckDB sobre un batch de selfplay TryMate.
-- Uso:
--   duckdb
--   SET VARIABLE batch = '/path/to/<batchId>';
--   .read views.sql
-- Requiere DuckDB >= 0.10 (SET VARIABLE + getvariable). Sin variables,
-- reemplazar getvariable('batch') por la ruta literal del batch.

CREATE OR REPLACE VIEW raw_games AS
SELECT *
FROM read_json_auto(
  getvariable('batch') || '/games-*.jsonl.gz',
  format = 'newline_delimited',
  union_by_name = true,
  ignore_errors = true
);

-- Una fila por partida.
CREATE OR REPLACE VIEW games AS
SELECT
  id,
  batchId,
  seed,
  rules.variant                                AS variant,
  rules.fingerprint                            AS fingerprint,
  players.BLANCAS.bot
    || coalesce(':' || players.BLANCAS.personality, '')
    || ' vs '
    || players.NEGRAS.bot
    || coalesce(':' || players.NEGRAS.personality, '') AS matchup,
  players.BLANCAS.bot                          AS white_bot,
  players.NEGRAS.bot                           AS black_bot,
  setupMode,
  result.winner                                AS winner,
  result.reason                                AS reason,
  result.plies                                 AS plies,
  result.scores.BLANCAS                        AS score_white,
  result.scores.NEGRAS                         AS score_black,
  result.durationMs                            AS duration_ms
FROM raw_games;

-- Una fila por ply (acción) de cada partida.
CREATE OR REPLACE VIEW plies AS
SELECT
  g.id            AS game_id,
  g.variant,
  p.n,
  p.player,
  p.kind,
  p.type,
  p.from[1]       AS from_x,
  p.from[2]       AS from_y,
  p.to[1]         AS to_x,
  p.to[2]         AS to_y,
  p.capture,
  coalesce(p.scored, false)  AS scored,
  coalesce(p.random, false)  AS random,
  p.decision.eval  AS eval,
  p.decision.depth AS depth,
  p.decision.nodes AS nodes
FROM raw_games g, UNNEST(g.plies) AS t(p);

-- Una fila por pieza desplegada en el setup (ambos bandos).
CREATE OR REPLACE VIEW setups AS
SELECT g.id AS game_id, g.variant, 'BLANCAS' AS side,
       s.type, s.x, s.y
FROM raw_games g, UNNEST(g.setup.BLANCAS.board) AS t(s)
UNION ALL
SELECT g.id AS game_id, g.variant, 'NEGRAS' AS side,
       s.type, s.x, s.y
FROM raw_games g, UNNEST(g.setup.NEGRAS.board) AS t(s);

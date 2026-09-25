-- Consultas comunes sobre las vistas de views.sql.
-- Precondición: SET VARIABLE batch = '...'; .read views.sql

-- 1) Ventaja de color por variante (incluye n y % de empates).
SELECT variant,
       count(*)                                              AS n,
       round(avg((winner = 'BLANCAS')::int) * 100, 1)        AS pct_blancas,
       round(avg((winner = 'NEGRAS')::int) * 100, 1)         AS pct_negras,
       round(avg((winner IS NULL)::int) * 100, 1)            AS pct_empates
FROM games
GROUP BY variant
ORDER BY variant;

-- 2) Duración (plies) por razón de fin y variante.
SELECT variant, reason,
       count(*)                AS n,
       round(avg(plies), 1)    AS plies_media,
       median(plies)           AS plies_p50,
       quantile(plies, 0.9)    AS plies_p90
FROM games
GROUP BY variant, reason
ORDER BY variant, reason;

-- 3) Capturas por tipo (captor → víctima).
SELECT capture AS captor, type AS victima, count(*) AS n
FROM plies
WHERE capture IS NOT NULL
GROUP BY captor, victima
ORDER BY n DESC;

-- 4) Columnas de anotación (¿por dónde entran los tantos?).
SELECT to_x AS columna, count(*) AS tantos
FROM plies
WHERE scored
GROUP BY columna
ORDER BY columna;

-- 5) Win rate según piezas en la fila delantera de despliegue
--    (fila más cercana a la fila de anotación propia).
WITH front AS (
  SELECT game_id, variant, side, count(*) AS piezas_front
  FROM setups s
  WHERE (side = 'BLANCAS' AND s.y = (
           SELECT max(y) FROM setups s2 WHERE s2.game_id = s.game_id AND s2.side = s.side))
     OR (side = 'NEGRAS' AND s.y = (
           SELECT min(y) FROM setups s2 WHERE s2.game_id = s.game_id AND s2.side = s.side))
  GROUP BY game_id, variant, side
),
won AS (
  SELECT f.*, (g.winner = f.side) AS gano
  FROM front f JOIN games g ON g.id = f.game_id
)
SELECT variant, piezas_front,
       count(*)                       AS n,
       round(avg(gano::int) * 100, 1)  AS pct_victorias
FROM won
GROUP BY variant, piezas_front
HAVING n >= 30
ORDER BY variant, piezas_front;

-- 6) Bajadas de banca por bando vs victoria.
WITH drops AS (
  SELECT game_id, variant, player, count(*) AS bajadas
  FROM plies
  WHERE kind = 'bench'
  GROUP BY game_id, variant, player
),
won AS (
  SELECT d.bajadas, (g.winner = d.player) AS gano
  FROM drops d JOIN games g ON g.id = d.game_id AND g.variant = d.variant
)
SELECT bajadas, count(*) AS n, round(avg(gano::int) * 100, 1) AS pct_victorias
FROM won
GROUP BY bajadas
HAVING n >= 30
ORDER BY bajadas;

-- 7) Las 20 partidas más largas del batch (para inspeccionar con replay).
SELECT id, variant, matchup, reason, plies, winner
FROM games
ORDER BY plies DESC
LIMIT 20;

-- 8) Exportar partidas a CSV (abrir en Numbers/Excel).
COPY (SELECT * FROM games)
TO '/tmp/trymate-games.csv' (HEADER, DELIMITER ',');

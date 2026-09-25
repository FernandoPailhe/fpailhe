---
name: trymate-computer-player
description: >
  Arquitectura y reglas de trabajo de los jugadores computadora de TryMate (Easy, Medium, Hard y
  personalidades): interfaz ComputerPlayer/BotContext, registro por dificultad, integración con el
  store (runBotTurn, botActing, tablero filtrado en HIDDEN, turnos async y cancelables), hook
  useComputerTurn, agnosticismo de reglas, determinismo con rng sembrado, arena/variantes/tácticas,
  rendimiento y peso del bundle. Usar al crear o modificar cualquier bot, dificultad o personalidad,
  al tocar application/ai/**, runBotTurn/useComputerTurn, o al escribir tests de bots. Triggers:
  "bot", "computer player", "EasyBot", "MediumBot", "HardBot", "dificultad", "personalidad",
  "ofensivo", "defensivo", "arena", "runBotTurn", "evaluación", "búsqueda", "minimax".
triggers:
  - user
  - model
---

# TryMate — Jugadores computadora

> Módulo: `apps/web/src/lab/trymate/`. Reglas y motor: skill `trymate-rules-agnostic` (leerlo
> primero). Store en general: `rugby-chess-state`. Datos de auto-juego: `trymate-selfplay`.

## Estado y planes (verificar contra el código)

| Pieza | Estado | Plan |
| --- | --- | --- |
| Easy (1-ply + azar), `ComputerPlayer`, `BotContext`, `rng.ts`, `SimState`, `arena.ts`, `ruleVariants` | Implementado | `doc/detailed-plan/trymate-computer-player/`, `trymate-rules-agnostic-easy/` |
| Medium (introspección, análisis, evaluación con desglose, posturas, alfa-beta 2–3, banca, setup por roles) | Implementado | `doc/detailed-plan/trymate-computer-player-medium/` |
| Hard (make/unmake, Zobrist+TT, PVS+quiescence, SEE, carreras con bloqueo por banca, worker, lazy chunk, pesos SPSA) + personalidades | Implementado | `doc/detailed-plan/trymate-computer-player-hard/` |

Al implementar un plan: seguir sus `tasks/NN-*.md` en orden; cada task es autocontenida. Si el
código real difiere de un nombre del plan, **manda el código** y se ajusta el plan.

## Mapa

```
application/
  GameState.ts            # store: startVsComputer, playAgain, getBotPlayer, runBotTurn, botController, botDifficulty, lastPassedPlayer, resolveStalledTurn
  useComputerTurn.ts      # agenda runBotTurn con delay (setup 250 ms / playing 700 ms), re-agenda con `tick`
  rules/turnRules.ts      # consultas de turno sin gating (canPlaceFromBench, hasAnyLegalAction, …)
  ai/
    ComputerPlayer.ts     # BotDifficulty, BotPlayAction, BotContext, ComputerPlayer, registry
    EasyBot.ts            # createEasyBot, choosePlayAction, getThreatenedSquares, EASY_BOT_CONFIG
    rng.ts                # Rng, createSeededRng (mulberry32)
    sim/SimState.ts       # simulación inmutable con reglas inyectadas
    arena.ts              # árbitro puro bot-vs-bot (playArenaGame, runArena)
    testing/ruleVariants.ts
    introspection/profiles.ts   # getRulesInsight: perfiles por tipo (roles, valor, matchup) + geometría, memoizado por fingerprint
    analysis/boardAnalysis.ts   # analyzeBoard: ataques, defensas, avances, tapones, carriles, aislamiento
    medium/config.ts      # MEDIUM_BOT_CONFIG, NEUTRAL_WEIGHTS, POSTURE_WEIGHTS, POSTURE_RULES
    medium/evaluation.ts  # evaluate / explainEvaluation / materialOf / runnerBonus
    medium/posture.ts     # choosePosture (DEFEND/ATTACK/BALANCED) + weightsFor
    medium/search.ts      # negamax alfa-beta + iterative deepening, orderMoves, searchBestMove
    medium/benchPlacement.ts  # chooseBenchPlacement (tipo × casilla → eval)
    medium/setupStrategy.ts   # targetComposition, chooseSetupPlacement, chooseBenchType
    MediumBot.ts          # fachada ComputerPlayer "medium" + lastDecision (MediumDecision)
    personality.ts        # union Personality (balanced|offensive|defensive)
    hard/                 # SearchBoard (make/unmake), zobrist+TT, search PVS+quiescence,
                          # see, race (corredores + bloqueo por banca), evaluation, weights(.json),
                          # personalities (perfiles de datos), setup (plan de ejército),
                          # worker+protocol+cliente (async, abortable), HardBot (facade lazy)
    testing/hardTestBot.ts  # factories de tests (forceInline, nodos); tuneHard.ts (SPSA)
```

## Contrato (no romper)

```ts
interface BotContext { board; bot; botState; opponentState; engine; rules; setupMode; rng }
interface ComputerPlayer {
  readonly difficulty: BotDifficulty;
  chooseSetupPlacement(ctx): { type; position } | null;
  chooseBenchType(ctx): PieceType | null;
  choosePlayAction(ctx): BotPlayAction;           // bench | move | pass
  // planificados (opcionales): choosePlayActionAsync(ctx, signal): Promise<BotPlayAction[]>;
  //   prepareSetupAsync(ctx, signal); getLastDecisionInfo(): DecisionInfo | null; dispose()
}
```

- **Estado interno del bot en la instancia** (plan de despliegue, caches), nunca en el store.
- **Puro:** `application/ai/**` sin React, Zustand ni `useGameStore`. Nunca mutar `ctx.board` ni
  piezas del store: clonar (`cloneBoard`) para simular.
- **Agnóstico:** nada de `GAME_RULES`/`GAME_CONFIG`/`PIECE_MOVEMENT_CONFIG`/`QuickStartLayout` ni
  `PieceType.X` (ESLint lo bloquea). Geometría con `ctx.rules` (`forward`, `homeRow`, `scoringRow`,
  `placementRows`); ataques con `ctx.engine.getCaptureSquares`; umbrales relativos al tamaño.
- **Juego limpio:** en SETUP HIDDEN el store pasa un tablero solo con piezas del bot
  (`boardWithOnlyOwner`). Un bot nunca lee `opponentState` para espiar el setup oculto.

## Pipeline del Medium (una decisión de PLAYING)

`MediumBot.choosePlayAction`: `simFromContext` → `analyzeBoard` → `choosePosture` → `weightsFor`
→ `chooseBenchPlacement` (la banca es acción libre: siempre que se pueda, baja la mejor
tipo × casilla evaluada) → `searchBestMove` (negamax alfa-beta, iterative deepening 2 plies,
3 en finales por `geometry.endgamePieces`; presupuesto en nodos; elección por `tolerance` +
`blunderChance` salvo que la mejor ya gane) → `lastDecision` con postura/depth/nodos/top-5.
En SETUP: `chooseSetupPlacement`/`chooseBenchType` de `setupStrategy` (composición objetivo por
valor de perfil, bloqueadores al frente, corredores en carril abierto, contra-picks por `matchup`;
en HIDDEN los términos de rival valen 0 porque el tablero llega filtrado).

## Integración con el store

- `startVsComputer(setupMode, difficulty?)`: humano = BLANCAS (`localPlayer`), bot = NEGRAS;
  crea `botController` con `createComputerPlayer`. `playAgain()` conserva dificultad (y personalidad cuando exista).
- `runBotTurn(rng?) → boolean`: guarda (turno del bot, no historial, fase SETUP/BENCH/PLAYING),
  arma `BotContext`, y aplica la decisión **a través de las acciones públicas** del store
  (`selectPieceTypeForSetup`+`placePieceInSetup`, `selectPieceTypeForBench`,
  `selectBenchPiece`+`placeBenchPiece`, `selectTile`+`movePiece`, `resolveStalledTurn` para pass)
  con `botActing = true` en `try/finally` (hace que `isLocalPlayerTurn()` devuelva true).
  Devuelve si el snapshot cambió → el hook deja de re-agendar si es `false` (evita loops).
- **Nunca** usar `handleTileClick` desde un bot.
- Una acción por llamada: la banca no consume turno, por eso el hook re-agenda (`tick`).
- **Historial:** `isViewingHistory` reemplaza `board` por un snapshot → el bot no debe actuar.
- **Async (Hard):** `runBotTurnAsync(signal)` con `botThinking`, token de turno
  (`fase|jugador|jugadas|banca|historial|controller`) y descarte de resultados viejos; loaders lazy
  (`import()`) por dificultad y `botLoading`. Hard corre la búsqueda en Web Worker
  (`HardBotClient` + `hard.worker`) con fallback inline, y `prepareSetupAsync` planifica el ejército
  una vez por partida (re-plan solo si cambia lo visible del rival en HIDDEN).

## Recetas

**Nueva dificultad:** implementar `ComputerPlayer` en `ai/<Nombre>Bot.ts` (o `ai/<nivel>/`), agregar
al union `BotDifficulty`, registrar (`registerComputerPlayer` o loader lazy si pesa > ~5 KB gzip),
opción en `DifficultySelector`, texto en `rulesContent.ts`, tests (ver abajo) y arena vs el nivel anterior.

**Ajustar fuerza/estilo:** tocar solo configs (`EASY_BOT_CONFIG`, `medium/config.ts`,
`hard/personalities.ts`, `hard/weights.json`), nunca ramas de código por caso. Usar
`explainEvaluation`/`explainHard` para ver qué término domina.

**Nueva personalidad (cuando exista Hard):** agregar perfil de datos en `hard/personalities.ts`
(`selfMul`, `oppMul`, `posture`, `contempt`, `tieWindow`, `tieBreak`, `setup`); estilo sí, nivel no:
40–60 % vs `balanced` y ≥ 60 % vs Medium.

## Tests (obligatorios por bot)

- `rng` sembrado (`createSeededRng`) → resultados deterministas; en búsquedas usar presupuesto
  por **nodos**, nunca por tiempo, en tests y arena.
- **Legalidad:** `runArena(bot, easy, variante, N, seed)` en todas las `ruleVariants` → `illegal === 0`.
- **Fuerza:** arena vs nivel anterior con umbral (Medium ≥ 75 % vs Easy; Hard ≥ 70 % vs Medium).
  Versión larga detrás de `TRYMATE_ARENA=1`; timeouts explícitos (`{ timeout: … }`).
- **Tácticas:** posiciones armadas a mano en `*.current-rules.test.ts`, ancladas a
  `rulesFingerprint`; si cambió, `describe.skipIf` + `console.warn` (re-anclar).
- **Store:** `BotFlow.test.ts` (ALTERNATING, HIDDEN, quick start, no actúa en historial/fuera de turno,
  HIDDEN no ve piezas rivales).
- **Rendimiento:** decisión Medium < 150 ms p95; Hard respeta su presupuesto (worker; inline en jsdom).

## Rendimiento y bundle

- Easy ≈ 2 KB gzip. Lógica pesada (Hard) en chunk lazy + Web Worker; el bundle principal no debe crecer.
- Nada de producción importa `ai/testing/**`, `arena.ts` ni tuning.
- Simulaciones sobre clones; `Board.getPieceAt` es O(n) hoy (Hard plan lo indexa).

## Checklist de revisión

- [ ] `application/ai/**` puro y agnóstico (lint verde; grep de `PieceType\.` / constantes vacío fuera de tests).
- [ ] Bot aplicado solo vía acciones públicas + `botActing`; sin `handleTileClick`.
- [ ] HIDDEN filtrado; historial respetado; `runBotTurn` devuelve `false` si no hizo nada.
- [ ] Tests: determinismo, legalidad en variantes, arena con umbral, tácticas ancladas.
- [ ] Sin dependencias nuevas; `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

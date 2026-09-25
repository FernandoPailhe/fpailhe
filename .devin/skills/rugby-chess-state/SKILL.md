---
name: rugby-chess-state
description: Expert skill for the TryMate (rugby-chess) Application State layer. Handles apps/web/src/lab/trymate/application/GameState.ts (Zustand store), application/rules/ (MovementRuleEngine, turnRules) and application/ai/ (ComputerPlayer, EasyBot, rng, sim, arena). Use this skill whenever adding a new game action, modifying state transitions, changing game phase logic, updating player state management, adding move validation rules, modifying the Zustand store shape, wiring new domain entities into the game flow, or changing bot behavior. Triggers for "add game action", "modify game state", "change phase logic", "update store", "add selectTile behavior", "modify movePiece", "change turn logic", "update PLACEMENT phase", "add to GameStateStore", "modify movement validation", "change how moves are calculated", "bot", "ComputerPlayer". Always use this skill for any GameState.ts or MovementRuleEngine.ts work — never modify state directly from React components.
---

# TryMate — State Layer Skill

> El módulo vive en `apps/web/src/lab/trymate/` (antes `rugby-chess`).

## Scope

```
apps/web/src/lab/trymate/application/
├── GameState.ts              # Zustand store — single source of truth
├── useComputerTurn.ts        # Hook: agenda runBotTurn con demora
├── rules/
│   ├── MovementRuleEngine.ts # Motor de movimiento data-driven (config inyectado)
│   └── turnRules.ts          # Consultas puras de turno; todas aceptan `rules?`
└── ai/
    ├── ComputerPlayer.ts     # Interfaz BotContext/ComputerPlayer + registro de fábricas
    ├── rng.ts                # Rng, createSeededRng (mulberry32)
    ├── EasyBot.ts            # Bot fácil agnóstico de reglas
    ├── MediumBot.ts          # Fachada "medium" (postura → banca → alfa-beta) + lastDecision
    ├── introspection/profiles.ts # getRulesInsight: perfiles/roles/matchup/geometría por fingerprint
    ├── analysis/boardAnalysis.ts # analyzeBoard: ataques, avances, tapones, carriles, aislamiento
    ├── medium/               # config, evaluation, posture, search, benchPlacement, setupStrategy
    ├── hard/                 # SearchBoard(make/unmake), zobrist+TT, search PVS, evaluation+SEE+race,
    │                         # setup planning, personalities, HardBot facade, HardBotClient+worker
    ├── personality.ts        # Personality union ("balanced"|"offensive"|"defensive")
    ├── arena.ts              # Árbitro bot-vs-bot sobre SimState (+ runArenaAsync + métricas)
    ├── sim/SimState.ts       # Estado funcional para simulación (sin store)
    └── testing/              # ruleVariants, hardTestBot (factories de test), tuneHard (SPSA)
```

**Dependencies:** imports from `../domain/` only (plus `zustand`). Never imports from `components/`.

---

## Zustand Store Architecture

`GameState.ts` exports `useGameStore` (shape + actions) and `createGameStore()` (instancia aislada para tests).

```typescript
// State fields relevantes a reglas/bot
board, gamePhase, gameMode, currentPlayer, player1State, player2State,
selectedPiece, selectedPieceTypeForPlacement, selectedBenchPiece,
validMoves, blockedMoves, movementEngine: new MovementRuleEngine(),
pieceIdCounter, moveHistory, isViewingHistory,
setupMode: SetupTurnMode,        // ALTERNATING | HIDDEN
setupCompleted: { player1, player2 },
setupPlayer, lastPassedPlayer,
botDifficulty: BotDifficulty,    // "easy" | "medium" | "hard"
botPersonality: Personality,     // "balanced" | "offensive" | "defensive"
botController: ComputerPlayer | null, // vive la instancia del bot (su estado interno)
botThinking: boolean,            // búsqueda async en curso (UI: "thinking…")
botLoading: boolean,             // chunk lazy del bot descargando (UI: "loading…")
```

---

## Tile Interaction: `handleTileClick` Is the Only Entry Point

UI components **never** call `selectTile`/`movePiece`/`placeBenchPiece` directly. Every board click goes through `handleTileClick(position)`: `isViewingHistory` guard → phase guard (SETUP/PLAYING) → bench free-action → confirmed move → `selectTile`.

---

## Game Phase Flow

```
SETUP → BENCH_SELECTION → PLAYING → GAME_OVER
```

- **SETUP:** colocación en `CURRENT_RULES.placementRows(player)` (derivadas de `PLACEMENT_DEPTH` + alto). La selección de tipo usa `feasibleTypes` (`domain/rules/composition.ts`) en `canSelectPieceType`/`canSelectBenchPieceType` — respeta mínimos/máximos por tipo y capacidad restante.
- **HIDDEN setup:** cada jugador completa 5+3 por su lado; `setupCompleted` trackea ambos. El bot recibe un tablero **filtrado con solo sus piezas** (`boardWithOnlyOwner`).
- **PLAYING:** `handleTileClick` → select/move; `checkScoring` retira la pieza que llega a `rules.scoringRow` y suma; `resolveStalledTurn` corre tras cada acción: si el jugador en turno no tiene acción legal pasa el turno (`lastPassedPlayer`), si ninguno tiene → `GAME_OVER`.
- **GAME_OVER:** `POINTS_TO_WIN` puntos o bloqueo mutuo.

---

## MovementRuleEngine (data-driven)

`new MovementRuleEngine(config = PIECE_MOVEMENT_CONFIG)` — el config se **inyecta**; el motor no tiene ramas por `PieceType.X`. Las mecánicas se leen de flags (`lShape`, `maxLateral`, `maxTotalDistance`, `canBypassBlocker`, `bypassMinDistance`, `requiresClearPath`, `blocksSides`, `blockedSideOffsets`, `captureIgnoresSideBlock`).

```typescript
getValidMoves(piece, board): Position[]
getBlockedMoves(piece, board): Position[]
isValidMove(context): boolean
canPassThrough(piece, targetPosition, board): boolean
getCaptureSquares(piece, board): Position[]  // casillas que capturaría si hubiera rival
```

- `getCaptureSquares` evalúa el patrón de captura con bloqueos "como si hubiera rival" — la fuente de amenazas del bot y de los tests de contrato.
- Para mecánicas nuevas: extender `PieceMovementConfig` (domain skill) + el motor — no agregar `if (piece.type === X)`.

**`turnRules.ts`:** `getPlacementRows`, `getScoringRow`, `getBenchPlacementSquares`, `canPlaceFromBench`, `hasAnyLegalMove`, `hasAnyLegalAction` — todas aceptan `rules: RulesView = CURRENT_RULES` como último parámetro.

---

## Bots: `ComputerPlayer`

`application/ai/ComputerPlayer.ts` define el contrato:

```typescript
interface BotContext {
  board, bot, botState, opponentState,
  engine: MovementRuleEngine, rules: RulesView,
  setupMode, rng: Rng,
}
interface ComputerPlayer {
  difficulty: BotDifficulty;                       // "easy" | "medium"
  chooseSetupPlacement(ctx): { type, position } | null;
  chooseBenchType(ctx): PieceType | null;
  choosePlayAction(ctx): BotPlayAction;            // bench | move | pass
}
```

- El estado interno del bot (plan de despliegue) vive en la instancia, no en el store.
- `createComputerPlayer(difficulty, rng)` via `FACTORIES`; registrar bots nuevos con `registerComputerPlayer`. **Hard usa loader lazy** (`LOADERS`/`loadComputerPlayer` con `import()`) — el chunk solo se descarga si se elige Hard.
- `startVsComputer(setupMode, difficulty?, personality?)` crea el controller; con loader lazy queda `botLoading` hasta resolver (guardado por `botControllerId`+`gameMode`: un controller tardío de una partida vieja se dispone); `playAgain` lo recrea; `reset`/`startVsComputer` disponen el anterior (`dispose()`).
- `runBotTurn(rng?)` ejecuta UNA acción atómica via acciones públicas con `botActing` (flag de closure que habilita `isLocalPlayerTurn()`). Construye el `BotContext` con `rules: CURRENT_RULES`; en SETUP HIDDEN pasa `boardWithOnlyOwner(board, bot)`.
- `runBotTurnAsync(signal, rng?)`: variante async para bots con `choosePlayActionAsync`/`prepareSetupAsync` (Hard). Prepara el setup una vez, setea `botThinking`, y aplica cada acción solo si el **token de turno** (`fase|jugador|jugadas|banca|historial|controller`) no cambió — reset/menú/historial abortan vía `signal` y el resultado tardío se descarta.
- **ESLint guard** (`eslint.config.js`): `application/ai/**/*.ts` (salvo tests/testing/sim) no puede importar `GAME_RULES`, `GAME_CONFIG`, `PIECE_MOVEMENT_CONFIG`, `QuickStartLayout` ni usar `PieceType.X` — los bots reciben todo por `ctx`.

**Easy:** 1-ply ponderado (score 100, capture 30, advance 3/fila, threatened −15, noise 5; 30% movimiento aleatorio, pick uniforme del top-3). Amenazas vía `engine.getCaptureSquares`. Setup: plan `generateRandomArmy` + `feasibleTypes`.

**Medium:** `choosePlayAction` = `simFromContext` → `analyzeBoard` → `choosePosture` (DEFEND/ATTACK/BALANCED, decide una vez en raíz) → `weightsFor` → `chooseBenchPlacement` (banca libre: mejor tipo × casilla por eval) → `searchBestMove` (negamax alfa-beta, iterative deepening 2 plies / 3 en finales, presupuesto en nodos, tolerancia + blunderChance). `lastDecision` guarda postura/depth/nodos/top-5 para diagnóstico. Setup: `medium/setupStrategy` (composición objetivo por valor de perfil, bloqueadores al frente, corredores en carril abierto, contra-picks por `matchup`). Todo lo que sabe de las reglas lo deriva de `getRulesInsight` (perfiles sondeados del motor: roles runner/attacker/blocker, valor, matchup en [−1,1]) — sin literales de tamaño ni tipos.

**Sim/arena:** `sim/SimState.ts` (`generateMoves`, `applySimMove`, `applySimBench`, `passTurn`, `simFromContext`, `cloneBoard` — todo inmutable) y `arena.ts` (`playArenaGame`, `runArena`) prueban bots con `RuleVariant` sin tocar el store. La arena es árbitro estricto: acción ilegal → `illegalAction`.

---

## Key Patterns in GameState

- `movePiece` → `board.movePiece` → `MoveRecord` con snapshot → `checkScoring` → `checkGameOver` → toggle → `resolveStalledTurn`.
- `placeBenchPiece` es acción libre (no cambia turno) → `resolveStalledTurn`.
- `board`, `playerNState`, `moveHistory` mutan in place — los componentes deben suscribirse a campos que cambian por acción (ver code-review skill).
- `quickStart(player1LayoutId?, player2LayoutId?)`: layout compatible o ejército aleatorio (`generateRandomArmy`) como fallback; nunca rompe por reglas.

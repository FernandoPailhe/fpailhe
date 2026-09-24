---
name: rugby-chess-domain
description: Expert skill for the TryMate (rugby-chess) Domain Layer. Handles everything in apps/web/src/lab/trymate/domain/ — entities (Board, GamePiece, Position, Tile, PlayerState, MoveHistory), interfaces (IGameState, IMovementRule), constants (GameConstants, PieceConstants, GameRules), config (RulesView, QuickStartLayout) and rules (composition, randomArmy). Use this skill whenever adding a new piece type, modifying movement configurations, defining a new entity, adding game rules, changing PIECE_MOVEMENT_CONFIG, updating GamePhase/GameMode enums, modifying board dimensions, or touching any interface contracts. Triggers for "add piece type", "modify movement rules", "add entity", "change constants", "define interface", "update game rules", "add new PieceType", "modify PIECE_MOVEMENT_CONFIG", "change board config". Always use this skill FIRST before touching any other layer — domain changes cascade upward and must be correct before the rest of the system adapts.
---

# TryMate — Domain Layer Skill

> El módulo vive en `apps/web/src/lab/trymate/` (antes `rugby-chess`). Tipos de pieza actuales: `FORT`, `STRIKER`, `PIONEER`; jugadores `BLANCAS`/`NEGRAS`; tablero 5×11.

## Scope

This skill owns `apps/web/src/lab/trymate/domain/` exclusively:

```
apps/web/src/lab/trymate/domain/
├── constants/
│   ├── GameConstants.ts      # GAME_CONFIG { BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE }
│   ├── PieceConstants.ts     # PieceType, Player, PIECE_MOVEMENT_CONFIG + tipos del config
│   └── GameRules.ts          # GAME_RULES (derivado), GamePhase, GameMode, SetupTurnMode
├── config/
│   ├── RulesView.ts          # RulesView, buildRulesView, CURRENT_RULES, rulesFingerprint
│   └── QuickStartLayout.ts   # Layouts tolerantes a cambios de reglas (warn + descarte)
├── rules/
│   ├── composition.ts        # countsOf, isCompositionFeasible, feasibleTypes
│   └── randomArmy.ts         # generateRandomArmy(rules, player, rng)
├── entities/
│   ├── Board.ts              # Board state and piece management
│   ├── GamePiece.ts          # Piece identity and direction
│   ├── Position.ts           # Coordinate value object (throws on negatives)
│   ├── Tile.ts               # Tile state machine
│   ├── PlayerState.ts        # Per-player counters and bench
│   └── MoveHistory.ts        # Move record for read-only history navigation
└── interfaces/
    ├── IGameState.ts         # State contract
    └── IMovementRule.ts      # Movement validation contract (+ getCaptureSquares)
```

**The domain layer has zero imports from application or components.** It is the foundation all other layers depend on. (The kit's `IRenderer.ts` was intentionally not ported — the React UI consumes the store directly.)

---

## Core Principle: Configuration Over Code — Single Source of Rules

`GAME_RULES` deriva todo lo que depende del tamaño del tablero y de la profundidad de despliegue:

- `PLACEMENT_DEPTH` (3) + `GAME_CONFIG.BOARD_HEIGHT` → `PLACEMENT_ROWS_PLAYER1/2` ([1,2,3] / [7,8,9]).
- `SCORING_ZONE_*` y `FORBIDDEN_ZONE_*` derivan de `BOARD_HEIGHT`.
- `TOTAL_PIECES_PER_PLAYER = PIECES_TO_PLACE + PIECES_IN_BENCH`.

`RulesView` (`domain/config/RulesView.ts`) es la vista inmutable de solo lectura que consumen store, motor, bots y textos: `width`, `height`, `pieceTypes`, `piecesToPlace`, `benchSize`, `minPerType`, `maxPerType`, `maxPerRow`, `pointsToWin`, `placementRows(p)`, `homeRow(p)`, `scoringRow(p)`, `forward(p)`. `CURRENT_RULES = buildRulesView(GAME_CONFIG, GAME_RULES)`; `buildRulesView(board, rulesSource)` construye variantes para tests/simulación.

All piece behavior is data-driven via `PIECE_MOVEMENT_CONFIG`. Never hard-code movement logic inside entities or engines — express rules as configuration objects.

---

## Adding a New Piece Type

Follow this exact sequence — all steps in `PieceConstants.ts`:

1. Add the type to the `PieceType` enum.
2. Add a full entry to `PIECE_MOVEMENT_CONFIG` (`PieceMovementConfig`): `movement`, `capture` (si aplica) y los flags de mecánica.

No other file in `domain/` needs to change: the engine, `feasibleTypes`, `generateRandomArmy` and the bots read `rules.pieceTypes` / config dynamically. For visuals: SVG en `apps/web/public/lab/trymate/pieces/` + mapeo en `lib/gameDisplay.ts` + prosa en `lib/rulesContent.ts` (los textos de piezas son manuales).

**Movement config shape (`PieceMovementConfig`):**
- `movement: MovementPattern` — `{ directions: DirectionVector[], minDistance, maxDistance, canCapture }`
- `alternativeMovement?: MovementPattern & { requiresClearPath?: boolean }` — patrón secundario; `requiresClearPath` exige camino libre (carga del STRIKER).
- `capture?: CapturePattern` — `{ directions, minDistance, maxDistance }`
- `blocksSides?: boolean` + `blockedSideOffsets?: DirectionVector[]` — bloqueo lateral del FORT
- `lShape?: boolean` + `maxLateral?` + `maxTotalDistance?` — movimiento en L del PIONEER
- `canBypassBlocker?: boolean` + `bypassMinDistance?: number` — el PIONEER puede pasar un bloqueo si el bloqueante está lejos
- `captureIgnoresSideBlock?: boolean` — el FORT puede capturar sobre casillas que él mismo bloquearía

`DirectionVector`: `{ dx, dy }` desde la perspectiva de BLANCAS (dy positivo = adelante). `getDirectionMultiplier()` invierte para NEGRAS.

---

## Receta: "Cambiar reglas del juego"

1. Editar `GAME_CONFIG` (tamaño), `GAME_RULES` (cantidades, `PLACEMENT_DEPTH`, puntos) y/o `PIECE_MOVEMENT_CONFIG` (movimientos con los flags existentes).
2. Si una mecánica no entra en los flags: extender `PieceMovementConfig` + `MovementRuleEngine`, y el test de contrato de `getCaptureSquares`.
3. Actualizar la prosa de piezas en `lib/rulesContent.ts` (los números se generan solos desde `CURRENT_RULES`).
4. `pnpm test`: contrato del motor, composición, quick start (mirar warnings de layouts descartados y ajustar `quickstart-layouts.json` si se quieren conservar), variantes de la arena (`application/ai/variants.test.ts`).
5. Jugar una partida vs Easy.

---

## Quick Start layouts

`domain/config/QuickStartLayout.ts` carga `quickstart-layouts.json` con dos niveles de validación: errores **estructurales** (JSON mal formado, tipos inválidos, ids duplicados) lanzan; **incompatibilidades con las reglas vigentes** (filas fuera de `placementRows`, composición imposible) descartan el layout con `console.warn`. Si no queda ninguno, el store genera ejércitos con `generateRandomArmy` como fallback.

---

## Composition helpers (`domain/rules/composition.ts`)

- `countsOf(types, rules)` / `emptyCounts(rules)` — contadores por tipo.
- `isCompositionFeasible(counts, remainingSlots, rules)` — máximos no superados, déficits de mínimos cubribles, capacidad suficiente.
- `feasibleTypes(counts, remainingSlots, rules)` — tipos elegibles sin dejar el ejército sin salida. Lo usan el store (`canSelectPieceType`/`canSelectBenchPieceType`), el bot y la arena.

---

## Entities: Key Contracts

**`GamePiece`**
- `id: string` — unique identifier
- `type: PieceType`
- `owner: Player`
- `position: Position | null` — null means on bench
- `getDirectionMultiplier(): 1 | -1` — +1 BLANCAS, −1 NEGRAS

**`Board`**
- `Map<string, Tile>` keyed by `"x,y"` and `Map<string, GamePiece>` keyed by piece id
- `addPiece()`, `removePiece()`, `movePiece()`, `getPieceAt()`, `getAllPieces()`
- `isValidPosition()` for bounds checking

**`Position`** — immutable `{ x, y }`, `equals()`; **el constructor lanza con coordenadas negativas** — chequear bordes antes de construir.

**`Tile`** — state machine `EMPTY | SELECTED | HIGHLIGHTED | OCCUPIED` (internal; the React UI derives highlighting from `selectedPiece`/`validMoves`/`blockedMoves`).

**`PlayerState`**
- `selectedPieces: PieceType[]` (solo tablero), `placedPieces: GamePiece[]`, `benchPieces: GamePiece[]`, `score`
- `addSelectedPiece()`, `addPlacedPiece()`, `addBenchPiece()`, `removeBenchPiece()`, `incrementScore()`, `getTotalSelectedCount()`

**`MoveHistory`** — `MoveRecord[]` con `boardSnapshot` JSON por jugada; `canGoBack()` es `currentIndex > 0` (quirk portado, no "arreglar").

---

## Adding or Modifying an Interface

1. Add the method signature to the interface in `domain/interfaces/`.
2. All implementing classes (in application) must be updated — coordinate with the state skill.
3. `IMovementRule` incluye `getCaptureSquares(piece, board): Position[]` — casillas que la pieza capturaría si hubiera un rival (respeta bloqueos); el bot y los tests de contrato dependen de él.

---

## TypeScript Constraints

Strict (`strict`, `noUncheckedIndexedAccess`) + ESLint `no-explicit-any`:
- Always type parameters and return values explicitly.
- `array[i]` is `T | undefined` — guard it, never assert blindly.
- Use `as const` for config objects to preserve literal types.
- There is **no `@/` path alias** — always use relative imports.

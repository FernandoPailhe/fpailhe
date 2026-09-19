---
name: rugby-chess-domain
description: Expert skill for the Rugby Chess Domain Layer. Handles everything in apps/web/src/lab/rugby-chess/domain/ — entities (Board, GamePiece, Position, Tile, PlayerState, MoveHistory), interfaces (IGameState, IMovementRule), and constants (GameConstants, PieceConstants, GameRules). Use this skill whenever adding a new piece type, modifying movement configurations, defining a new entity, adding game rules, changing PIECE_MOVEMENT_CONFIG, updating GamePhase/GameMode enums, modifying board dimensions, or touching any interface contracts. Triggers for "add piece type", "modify movement rules", "add entity", "change constants", "define interface", "update game rules", "add new PieceType", "modify PIECE_MOVEMENT_CONFIG", "change board config". Always use this skill FIRST before touching any other layer — domain changes cascade upward and must be correct before the rest of the system adapts.
---

# Rugby Chess — Domain Layer Skill

## Scope

This skill owns `apps/web/src/lab/rugby-chess/domain/` exclusively:

```
apps/web/src/lab/rugby-chess/domain/
├── constants/
│   ├── GameConstants.ts      # Board dimensions (BOARD_WIDTH/HEIGHT, TILE_SIZE)
│   ├── PieceConstants.ts     # PieceType enum, Player enum, PIECE_MOVEMENT_CONFIG
│   └── GameRules.ts          # GAME_RULES, GamePhase, GameMode, PieceCount
├── entities/
│   ├── Board.ts              # Board state and piece management
│   ├── GamePiece.ts          # Piece identity and direction
│   ├── Position.ts           # Coordinate value object
│   ├── Tile.ts               # Tile state machine
│   ├── PlayerState.ts        # Per-player counters and bench
│   └── MoveHistory.ts        # Move record for read-only history navigation
└── interfaces/
    ├── IGameState.ts         # State contract
    └── IMovementRule.ts      # Movement validation contract
```

**The domain layer has zero imports from application or components.** It is the foundation all other layers depend on. (The kit's `IRenderer.ts` was intentionally not ported — the React UI consumes the store directly.)

---

## Core Principle: Configuration Over Code

All piece behavior is data-driven via `PIECE_MOVEMENT_CONFIG`. Never hard-code movement logic inside entities or engines — instead express rules as configuration objects.

```typescript
// Good: behavior expressed as config
export const PIECE_MOVEMENT_CONFIG = {
  [PieceType.BULWARK]: {
    movement: { directions: [{dx:0, dy:1}], minDistance:1, maxDistance:1, canCapture:false },
    capture: { directions: [{dx:1, dy:1},{dx:-1, dy:1}], minDistance:1, maxDistance:1 },
    blocksSides: true,
    blockedSideOffsets: [{dx:-1, dy:0},{dx:1, dy:0}],
  }
} as const;
```

---

## Adding a New Piece Type

Follow this exact sequence — all steps in `PieceConstants.ts`:

1. Add the type to the `PieceType` enum.
2. Add a full entry to `PIECE_MOVEMENT_CONFIG` with `movement`, `capture` (if applicable), `blocksSides`, and any special flags.

No other file in `domain/` needs to change. The application layer (`MovementRuleEngine`) reads config dynamically. If the piece needs a visual asset, add the SVG to `apps/web/public/lab/rugby-chess/pieces/` and map it in `lib/gameDisplay.ts` (`PIECE_ASSET`/`PIECE_LABEL`).

**Interface types available for movement config:**
- `MovementPattern`: `{ directions: DirectionVector[], minDistance, maxDistance, canCapture }`
- `CapturePattern`: `{ directions: DirectionVector[], minDistance, maxDistance }`
- `DirectionVector`: `{ dx: number, dy: number }` — always expressed from Player.BLANCAS perspective (positive dy = forward). `getDirectionMultiplier()` handles Player.NEGRAS automatically.

Special flags used in existing pieces:
- `blocksSides: boolean` + `blockedSideOffsets: DirectionVector[]` — BULWARK side-blocking
- `alternativeMovement: MovementPattern` — secondary move pattern (VANGUARD)
- `canBypassBlocker: boolean` + `bypassMinDistance: number` — APEX bypass rule
- `maxTotalDistance: number` — APEX total L-shape limit

---

## Modifying Game Rules

`GameRules.ts` holds `GAME_RULES` as a `const` object. Changing values here affects the entire game flow:

```typescript
export const GAME_RULES = {
  TOTAL_PIECES_PER_PLAYER: 8,
  PIECES_TO_PLACE: 5,
  PIECES_IN_BENCH: 3,
  MIN_PIECES_PER_TYPE: 2,
  MAX_PIECES_PER_TYPE: 4,
  PLACEMENT_ROWS_PLAYER1: [1, 2, 3],
  PLACEMENT_ROWS_PLAYER2: [7, 8, 9],
  MAX_PIECES_PER_ROW: 2,
  SCORING_ZONE_PLAYER1: 10,   // row index where Player1 scores
  SCORING_ZONE_PLAYER2: 0,    // row index where Player2 scores
  POINTS_TO_WIN: 3,
  FORBIDDEN_ZONE_PLAYER1: 0,
  FORBIDDEN_ZONE_PLAYER2: 10,
}
```

After changing `GAME_RULES`, notify the state skill — `GameState.ts` uses these values for phase transitions and validation.

---

## Entities: Key Contracts

**`GamePiece`**
- `id: string` — unique identifier
- `type: PieceType`
- `owner: Player`
- `position: Position | null` — null means on bench
- `getDirectionMultiplier(): 1 | -1` — returns +1 for BLANCAS, -1 for NEGRAS

**`Board`**
- Uses `Map<string, Tile>` keyed by `"x,y"` and `Map<string, GamePiece>` keyed by piece id
- `addPiece()`, `removePiece()`, `movePiece()`, `getPieceAt()`, `getAllPieces()`
- `isValidPosition()` for bounds checking

**`Position`**
- Immutable value object: `{ x: number, y: number }`
- Has `equals(other: Position): boolean`

**`Tile`** — state machine with `TileState`: `EMPTY | SELECTED | HIGHLIGHTED | OCCUPIED` (internal mechanism; the React UI derives highlighting from `selectedPiece`/`validMoves`/`blockedMoves` instead)

**`PlayerState`**
- Tracks `selectedPieces: PieceType[]`, `placedPieces: GamePiece[]`, `benchPieces: GamePiece[]`, `score: number`
- Methods: `addSelectedPiece()`, `getSelectedPieceCount()`, `addPlacedPiece()`, `addBenchPiece()`, `removeBenchPiece()`, `incrementScore()`

**`MoveHistory`**
- Stores `MoveRecord[]` with a `boardSnapshot` (JSON) per move
- `canGoBack()` is `currentIndex > 0` — the pre-move-1 state is not navigable (ported quirk, do not "fix")

---

## Adding or Modifying an Interface

Interfaces are contracts consumed by the application layer. When adding a method:

1. Add the method signature to the interface in `domain/interfaces/`.
2. All implementing classes (in application) must be updated — coordinate with the state skill.
3. Keep interfaces minimal and focused: `IGameState` = state only, `IMovementRule` = validation only.

---

## TypeScript Constraints

The monorepo uses strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) plus ESLint `no-explicit-any`. When writing domain code:
- Always type parameters and return values explicitly.
- `array[i]` is `T | undefined` — guard it, never assert blindly.
- Use `as const` for config objects to preserve literal types.
- Use interface segregation — don't add unrelated methods to existing interfaces.
- There is **no `@/` path alias** in this repo — always use relative imports (`../entities/...`).

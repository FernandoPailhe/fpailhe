---
name: rugby-chess-domain
description: Expert skill for the Rugby Chess Domain Layer. Handles everything in src/domain/: entities (Board, GamePiece, Position, Tile, PlayerState, MoveHistory), interfaces (IRenderer, IGameState, IMovementRule), and constants (GameConstants, PieceConstants, GameRules). Use this skill whenever adding a new piece type, modifying movement configurations, defining a new entity, adding game rules, changing PIECE_MOVEMENT_CONFIG, updating GamePhase/GameMode enums, modifying board dimensions, or touching any interface contracts. Triggers for "add piece type", "modify movement rules", "add entity", "change constants", "define interface", "update game rules", "add new PieceType", "modify PIECE_MOVEMENT_CONFIG", "change board config". Always use this skill FIRST before touching any other layer — domain changes cascade upward and must be correct before the rest of the system adapts.
---

# Rugby Chess — Domain Layer Skill

## Scope

This skill owns `src/domain/` exclusively:

```
src/domain/
├── constants/
│   ├── GameConstants.ts      # Board dimensions, camera, lighting, colors
│   ├── PieceConstants.ts     # PieceType enum, Player enum, PIECE_MOVEMENT_CONFIG, PIECE_VISUAL_CONFIG
│   └── GameRules.ts          # GAME_RULES, GamePhase, GameMode, PieceCount
├── entities/
│   ├── Board.ts              # Board state and piece management
│   ├── GamePiece.ts          # Piece identity and direction
│   ├── Position.ts           # Coordinate value object
│   ├── Tile.ts               # Tile state machine
│   ├── PlayerState.ts        # Per-player counters and bench
│   └── MoveHistory.ts        # Command record for undo/redo
└── interfaces/
    ├── IRenderer.ts          # Renderer contract
    ├── IGameState.ts         # State contract
    └── IMovementRule.ts      # Movement validation contract
```

**The domain layer has zero imports from application, infrastructure, or presentation.** It is the foundation all other layers depend on.

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
3. Add an entry to `PIECE_VISUAL_CONFIG` with `geometry`, `scale`, and `heightOffset`.

No other file in `src/domain/` needs to change. The application layer (`MovementRuleEngine`) reads config dynamically.

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

**`Tile`** — state machine with `TileState`: `EMPTY | SELECTED | HIGHLIGHTED | OCCUPIED`

**`PlayerState`**
- Tracks `pieceCounts: PieceCount`, `score: number`, `benchPieces: GamePiece[]`
- Methods: `addPiece()`, `removePiece()`, `addToBench()`, `removeFromBench()`

---

## Adding or Modifying an Interface

Interfaces are contracts consumed by the application and presentation layers. When adding a method:

1. Add the method signature to the interface in `src/domain/interfaces/`.
2. All implementing classes (in application/infrastructure) must be updated — coordinate with the appropriate layer skill.
3. Keep interfaces minimal and focused: `IRenderer` = rendering only, `IGameState` = state only, `IMovementRule` = validation only.

---

## TypeScript Constraints

The project uses strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`). When writing domain code:
- Always type parameters and return values explicitly.
- Use `as const` for config objects to preserve literal types.
- Use interface segregation — don't add unrelated methods to existing interfaces.
- Path alias `@/*` maps to `src/*`, but domain files use relative imports (`../entities/...`) since they're within the same layer.

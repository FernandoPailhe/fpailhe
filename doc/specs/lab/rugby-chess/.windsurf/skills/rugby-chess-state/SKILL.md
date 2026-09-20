---
name: rugby-chess-state
description: Expert skill for the Rugby Chess Application State layer. Handles src/application/GameState.ts (Zustand store) and src/application/rules/MovementRuleEngine.ts. Use this skill whenever adding a new game action, modifying state transitions, changing game phase logic, updating player state management, adding move validation rules, modifying the Zustand store shape, or wiring new domain entities into the game flow. Triggers for "add game action", "modify game state", "change phase logic", "update store", "add selectTile behavior", "modify movePiece", "change turn logic", "update PLACEMENT phase", "add to GameStateStore", "modify movement validation", "change how moves are calculated". Always use this skill for any GameState.ts or MovementRuleEngine.ts work — never modify state directly from renderer or presentation components.
---

# Rugby Chess — State Layer Skill

## Scope

This skill owns:

```
src/application/
├── GameState.ts              # Zustand store — single source of truth (~956 lines)
└── rules/
    └── MovementRuleEngine.ts # Movement validation engine (~505 lines)
```

**Dependencies:** imports from `src/domain/` only. Never imports from infrastructure or presentation.

---

## Zustand Store Architecture

`GameState.ts` exports a single Zustand store: `useGameStore`. It is both the state shape and the action definitions.

```typescript
export const useGameStore = create<GameStateStore>((set, get) => ({
  // State fields
  board: createInitialBoard(),
  gamePhase: GamePhase.SETUP,
  gameMode: GameMode.PVP,
  currentPlayer: Player.BLANCAS,
  player1State: new PlayerState('player1'),
  player2State: new PlayerState('player2'),
  selectedPiece: null,
  selectedPieceTypeForPlacement: PieceType | null,
  selectedBenchPiece: GamePiece | null,
  validMoves: Position[],
  blockedMoves: Position[],
  movementEngine: new MovementRuleEngine(),
  pieceIdCounter: number,
  moveHistory: MoveHistory,
  isViewingHistory: boolean,

  // Actions (30+ methods)
  selectPieceTypeForSetup, selectPieceTypeForBench, placePieceInSetup,
  placeBenchPiece, selectBenchPiece, selectTile, hoverTile,
  movePiece, startGame, reset, quickStart,
  getCurrentPlayerState, getOpponentPlayerState,
  checkScoring, checkGameOver, canSelectPieceType,
  canSelectBenchPieceType, canPlaceBenchPiece,
  setGameMode,
  goBackInHistory, goForwardInHistory, returnToPresent,
  getMoveHistory, canGoBack, canGoForward,
}));
```

---

## Adding a New Action

Actions live inside the `create()` callback. Use `set()` for state mutations and `get()` to read current state.

```typescript
// Pattern for a new action
myNewAction: (param: SomeType) => {
  const state = get();
  // 1. Read what you need from state
  // 2. Compute next state (pure logic, no side effects)
  // 3. Call set() once with the new state slice
  set({
    someField: newValue,
    otherField: otherNewValue,
  });
},
```

Key rules:

- Keep actions pure — no direct DOM manipulation, no rendering calls.
- Use `get()` to access other state fields and call other actions (`get().checkGameOver()`).
- If an action needs to run after a state update (async or sequenced), use `setTimeout(() => get().nextAction(), 0)` to avoid nested `set()` calls.
- The renderer subscribes to state changes; it will automatically re-render after `set()`.

---

## Game Phase Flow

```
SETUP → BENCH_SELECTION → PLAYING → GAME_OVER
```

- **SETUP:** Players select and place pieces on their rows (`PLACEMENT_ROWS_PLAYER1/2`). Each player selects 5 pieces; 3 remain as bench. Enforces `MIN/MAX_PIECES_PER_TYPE`, `MAX_PIECES_PER_ROW`.
- **BENCH_SELECTION:** Player assigns 3 pieces to bench from remaining allocation.
- **PLAYING:** Turn-based. `selectTile()` → `movePiece()` cycle. After each move: `checkScoring()` → `checkGameOver()` → toggle `currentPlayer`.
- **GAME_OVER:** Triggered when a player reaches `POINTS_TO_WIN` (3 scores).

When adding a new phase, add it to `GamePhase` enum in `src/domain/constants/GameRules.ts` first (domain skill), then handle transitions here.

---

## MovementRuleEngine

`MovementRuleEngine` implements `IMovementRule` and is instantiated once in the store as `movementEngine`.

**Public API:**

```typescript
getValidMoves(piece: GamePiece, board: Board): Position[]
getBlockedMoves(piece: GamePiece, board: Board): Position[]
isValidMove(context: MoveValidationContext): boolean
canPassThrough(piece: GamePiece, targetPosition: Position, board: Board): boolean
```

**When to modify `MovementRuleEngine`:**

- New piece type requires special move logic (like APEX's L-shape)
- Existing piece movement rules change in `PIECE_MOVEMENT_CONFIG`
- New blocking mechanic is introduced

**Pattern for special piece movement:**

- Add a `get[PieceName]ValidMoves()` private method (see `getApexValidMoves()` as reference)
- Add a branch in `getValidMoves()` for the new piece type
- Blocked moves (`getBlockedMoves()`) should mirror the same special-case handling

**Direction convention:** `dy` is always expressed as positive = forward (toward opponent). The `piece.getDirectionMultiplier()` converts: +1 for BLANCAS, -1 for NEGRAS.

---

## Key Patterns in GameState

**Move execution flow:**

```typescript
selectTile(position) → {
  if PLACEMENT phase: placePieceInSetup(position)
  if PLAYING phase:
    if no selectedPiece: try to select piece at position
    if selectedPiece and position is valid move: movePiece(position)
    if selectedPiece and position is another own piece: switch selection
}

movePiece(to) → {
  board.movePiece(pieceId, to)
  addToMoveHistory()
  checkScoring(movedPiece)
  checkGameOver()
  toggle currentPlayer
  clearSelection()
}
```

**Scoring check:**

- BLANCAS scores when a piece reaches `SCORING_ZONE_PLAYER1` (row 10)
- NEGRAS scores when a piece reaches `SCORING_ZONE_PLAYER2` (row 0)
- On score: piece is returned to original player's bench, score incremented

**History navigation:**

- `moveHistory: MoveHistory` stores `MoveRecord[]`
- `isViewingHistory: boolean` — while true, moves are disabled; UI shows historical state
- `goBackInHistory()`, `goForwardInHistory()`, `returnToPresent()` navigate without mutating canonical state

---

## IGameState Interface

`src/domain/interfaces/IGameState.ts` defines the public contract consumed by `GameController`. When adding new public actions intended for use in the presentation layer:

1. Add the method signature to `IGameState`
2. Implement it in `useGameStore`
3. Wire it in `GameController` via the `gameState` reference (presentation skill handles this)

---

## TypeScript Notes

- `useGameStore` is typed as `create<GameStateStore>` — the full interface must stay in sync.
- Actions that return values (e.g., `getCurrentPlayerState()`) use `get()` and return directly — they don't call `set()`.
- `canSelectPieceType()` and similar predicates are pure computed — keep them side-effect free.
- The `pieceIdCounter` is a monotonic integer used to generate unique piece IDs: `piece_${++get().pieceIdCounter}`.

---
name: rugby-chess-state
description: Expert skill for the Rugby Chess Application State layer. Handles apps/web/src/lab/rugby-chess/application/GameState.ts (Zustand store) and apps/web/src/lab/rugby-chess/application/rules/MovementRuleEngine.ts. Use this skill whenever adding a new game action, modifying state transitions, changing game phase logic, updating player state management, adding move validation rules, modifying the Zustand store shape, or wiring new domain entities into the game flow. Triggers for "add game action", "modify game state", "change phase logic", "update store", "add selectTile behavior", "modify movePiece", "change turn logic", "update PLACEMENT phase", "add to GameStateStore", "modify movement validation", "change how moves are calculated". Always use this skill for any GameState.ts or MovementRuleEngine.ts work — never modify state directly from React components.
---

# Rugby Chess — State Layer Skill

## Scope

This skill owns:

```
apps/web/src/lab/rugby-chess/application/
├── GameState.ts              # Zustand store — single source of truth
└── rules/
    └── MovementRuleEngine.ts # Movement validation engine
```

**Dependencies:** imports from `../domain/` only (plus `zustand`). Never imports from `components/`.

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
  placeBenchPiece, selectBenchPiece, selectTile, handleTileClick, hoverTile,
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

## Tile Interaction: `handleTileClick` Is the Only Entry Point

UI components **never** call `selectTile`/`movePiece`/`placeBenchPiece` directly. Every board click goes through `handleTileClick(position)`, which encapsulates:

1. `isViewingHistory` guard — history viewing is read-only.
2. Phase guard — only `SETUP` and `PLAYING` accept tile clicks.
3. Bench placement priority — free action when `canPlaceBenchPiece()` and the tile is empty.
4. Confirmed move — `selectedPiece` + `validMoves` hit → `movePiece`.
5. Otherwise → `selectTile` (select / reselect / deselect / setup placement).

When adding interaction behavior, extend `handleTileClick` (or the action it delegates to) — never bypass it from a component.

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
- React components subscribe via `useGameStore`; they automatically re-render after `set()`.

---

## Game Phase Flow

```
SETUP → BENCH_SELECTION → PLAYING → GAME_OVER
```

- **SETUP:** Players select and place pieces on their rows (`PLACEMENT_ROWS_PLAYER1/2`). Each player places 5 pieces; 3 remain as bench. Enforces `MIN/MAX_PIECES_PER_TYPE`, `MAX_PIECES_PER_ROW`.
- **BENCH_SELECTION:** Player assigns 3 pieces to bench from remaining allocation.
- **PLAYING:** Turn-based. `handleTileClick()` → `selectTile()`/`movePiece()` cycle. After each move: `checkScoring()` → `checkGameOver()` → toggle `currentPlayer`.
- **GAME_OVER:** Triggered when a player reaches `POINTS_TO_WIN` (3 scores), or when neither side has legal moves.

When adding a new phase, add it to `GamePhase` enum in `domain/constants/GameRules.ts` first (domain skill), then handle transitions here.

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
handleTileClick(position) → {
  if isViewingHistory: return
  if PLAYING && canPlaceBenchPiece() && empty tile: placeBenchPiece(position)
  if selectedPiece && validMoves hit: movePiece(position)
  else: selectTile(position)
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
- On score: piece is removed from the board, score incremented

**History navigation:**
- `moveHistory: MoveHistory` stores `MoveRecord[]` with `boardSnapshot` JSON
- `isViewingHistory: boolean` — while true, `handleTileClick` no-ops and the UI disables the board
- `goBackInHistory()`, `goForwardInHistory()`, `returnToPresent()` restore the board via `restoreBoardFromSnapshot()` — they navigate without mutating canonical state

**Important:** `board`, `playerNState`, `moveHistory` are class instances that **mutate in place**. Components that render board content must subscribe to fields that change per action (or the whole store) — see the code-review skill.

---

## IGameState Interface

`domain/interfaces/IGameState.ts` defines the public contract implemented by the `GameState` wrapper class at the bottom of `GameState.ts`. When adding new public actions intended for external consumers:
1. Add the method signature to `IGameState`
2. Implement it in `useGameStore`
3. Expose it via the `GameState` wrapper if needed

---

## TypeScript Notes

- `useGameStore` is typed as `create<GameStateStore>` — the full interface must stay in sync.
- Actions that return values (e.g., `getCurrentPlayerState()`) use `get()` and return directly — they don't call `set()`.
- `canSelectPieceType()` and similar predicates are pure computed — keep them side-effect free.
- The `pieceIdCounter` is a monotonic integer used to generate unique piece IDs: `piece_${++get().pieceIdCounter}`.
- `GameMode` only has `PVP` — no AI mode exists in this port (Phase 2).

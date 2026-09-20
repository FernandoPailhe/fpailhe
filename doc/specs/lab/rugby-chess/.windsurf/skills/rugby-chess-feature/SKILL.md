---
name: rugby-chess-feature
description: Orchestrator skill for planning and implementing complete features in Rugby Chess (TypeScript / Three.js / Zustand). Use this skill whenever building something that spans multiple layers: a new piece type with visual + logic + UI, a new game mode end-to-end, a new game phase, or any non-trivial capability that touches more than one layer. Triggers for "add feature", "implement end-to-end", "build complete X", "add new piece type", "create new game mode", "add multiplayer", "implement scoring change", "add replay system", "add new phase", "implement undo system", "add sound effects system", "integrate analytics". This skill coordinates across domain, state, renderer, and presentation layers in the correct order. Always invoke it first for multi-layer work — it delegates to the specialized layer skills.
---

# Rugby Chess — Feature Orchestrator Skill

## Purpose

This skill plans and sequences multi-layer feature work in Rugby Chess. It knows the **correct change order** dictated by Clean Architecture, which specialised skills to delegate to, and how to avoid cross-layer coupling violations.

The four specialised skills it coordinates:

- **rugby-chess-domain** → `src/domain/`
- **rugby-chess-state** → `src/application/GameState.ts` + `rules/`
- **rugby-chess-3d-renderer** → `src/infrastructure/rendering/`
- **rugby-chess-presentation** → `src/presentation/`

---

## Architecture Dependency Order

Dependencies flow strictly downward. Changes must be implemented **bottom-up**:

```
presentation   ← depends on application + domain
    ↑
application    ← depends on domain only
(state)
    ↑
infrastructure ← depends on domain only (parallel to application)
    ↑
domain         ← no dependencies (foundation)
```

**Always start at the layer where the change originates.** If the feature requires new domain concepts (new piece type, new rule, new interface method), begin there. Never shortcut this — a missing domain type causes cascading TypeScript errors in all layers above.

---

## Feature Implementation Playbook

### Step 1 — Decompose the feature

Break the request into layer-specific tasks:

| Layer        | What changes?                                                             |
| ------------ | ------------------------------------------------------------------------- |
| Domain       | New types, enums, constants, interface method signatures, entity behavior |
| State        | New store fields, new actions, phase transition logic                     |
| Renderer     | New geometry, new material, new visual state, new animation               |
| Presentation | New buttons, new UI updates, new event handlers, new tutorial steps       |

Ask: which layers are NOT needed? Skip them. A visual-only change (new tile color) touches only Renderer.

### Step 2 — Implement domain first

Use **rugby-chess-domain** skill for:

- New `PieceType` enum values
- New entries in `PIECE_MOVEMENT_CONFIG` and `PIECE_VISUAL_CONFIG`
- New `GamePhase` or `GameMode` values
- New `GAME_RULES` constants
- New or modified interface methods (`IRenderer`, `IGameState`, `IMovementRule`)
- New entities or entity methods

**Deliverable:** TypeScript compiles cleanly at the domain level with no imports from upper layers.

### Step 3 — Implement application layer (State)

**State** (use **rugby-chess-state** skill):

- New Zustand store fields referencing new domain types
- New actions implementing game logic
- Updates to `MovementRuleEngine` for new piece movement
- Phase transition updates

### Step 4 — Implement infrastructure (can be parallel with Step 3 if domain is stable)

Use **rugby-chess-3d-renderer** skill:

- New piece geometry for new piece types
- New tile visual states
- New animations or effects
- Camera or lighting changes

### Step 5 — Implement presentation last

Use **rugby-chess-presentation** skill:

- Wire new state actions to buttons
- Update `UIManager` for new display fields
- Register event handlers
- Add tutorial steps if the feature should be tutorialized

---

## Common Feature Templates

### Adding a New Piece Type

```
1. [Domain]  Add PieceType.NEW_PIECE to enum
2. [Domain]  Add entry to PIECE_MOVEMENT_CONFIG with movement/capture patterns
3. [Domain]  Add entry to PIECE_VISUAL_CONFIG with geometry + scale
4. [State]   Add special movement logic to MovementRuleEngine if needed
5. [State]   Update canSelectPieceType() limits if piece count rules change
6. [Renderer] Add geometry case in Piece3D.createGeometry()
7. [Presentation] Add piece button in PieceButtonManager for SETUP phase
8. [Presentation] Add tutorial step explaining the new piece
```

### Adding a New Game Mode

```
1. [Domain]  Add GameMode.NEW_MODE to enum
2. [State]   Handle new mode in setGameMode() — adjust rules
3. [State]   Add any new game flow logic triggered by the mode
4. [Presentation] Add mode selection button in index.html
5. [Presentation] Wire button handler in setupGameModeHandlers()
6. [Presentation] Update UIManager to show mode-specific UI elements
```

### Adding a New Game Phase

```
1. [Domain]  Add GamePhase.NEW_PHASE to enum
2. [State]   Add transition logic: what triggers entry, what triggers exit
3. [State]   Add actions specific to this phase
4. [Presentation] Add phase-specific UI panel in index.html
5. [Presentation] Update GameController.updateUI() to show/hide phase UI
6. [Presentation] Update TutorialSteps if the phase needs explanation
```

### Adding a Visual Effect or Animation

```
1. [Renderer] Implement in ThreeJSRenderer / Tile3D / Piece3D
2. [Renderer] Use render loop delta time for smooth animation
3. [Presentation] If effect is triggered by user action, add trigger in GameController
   (e.g., call renderer.playScoreAnimation() after checkScoring())
```

---

## Cross-Layer Communication Rules

These rules prevent coupling violations:

| FROM           | TO              | Allowed?         | How                                                        |
| -------------- | --------------- | ---------------- | ---------------------------------------------------------- |
| Presentation   | Application     | ✅ Yes           | Call `useGameStore.getState().action()`                    |
| Presentation   | Domain          | ✅ Yes           | Import types/constants                                     |
| Presentation   | Infrastructure  | ⚠️ Via interface | Only through `IRenderer`, never `ThreeJSRenderer` directly |
| Application    | Domain          | ✅ Yes           | Direct import                                              |
| Application    | Infrastructure  | ❌ No            | Never — state doesn't know about rendering                 |
| Application    | Presentation    | ❌ No            | Never — no DOM access in application layer                 |
| Infrastructure | Domain          | ✅ Yes           | Direct import                                              |
| Infrastructure | Application     | ❌ No            | Never — renderer doesn't read from Zustand                 |
| Domain         | Any upper layer | ❌ No            | Domain has zero upward imports                             |

**If you find yourself violating these rules**, stop and reconsider the design. Usually the fix is to put shared logic in domain (as an entity method or constant) rather than importing across forbidden boundaries.

---

## Avoiding Common Mistakes

- **Don't add game logic to GameController.** If you find yourself writing `if piece.position === scoring zone` in `GameController.ts`, that logic belongs in `GameState.ts` (`checkScoring()`).
- **Don't read Zustand store from ThreeJSRenderer.** The renderer receives data via `updateBoard(board)`. If the renderer needs more data, extend `IRenderer` and pass data through the interface method.
- **Don't hard-code behavior in entities.** `Board.ts` should not contain game rules like "can't place in forbidden zone". That belongs in `GameState` validation.
- **Don't import `THREE` outside of `src/infrastructure/`.** If a constant (like a color) needs to be shared, express it as a hex number in `GameConstants.ts` and convert to `THREE.Color` inside the renderer.
- **Don't create new files for trivial additions.** Add a new piece type entry to the existing `PieceConstants.ts` — don't create `NewPieceConstants.ts`.

---

## Build & Validation

After implementing a feature:

```bash
# Check TypeScript compiles cleanly
npx tsc --noEmit

# Run dev server to test visually
npm run dev
```

The project uses Vite with HMR — changes are reflected instantly in the browser. Check the browser console for Three.js warnings (unfreed geometries, missing userData on meshes).

Chunk size warning threshold is 1000KB — Three.js is in its own chunk. Don't import new heavy libraries without checking the bundle impact.

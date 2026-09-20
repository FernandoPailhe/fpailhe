---
name: rugby-chess-code-review
description: Code review skill for Rugby Chess — quality gate after each layer implementation step. Reviews architecture compliance, TypeScript strictness, naming conventions, SOLID principles, cross-layer boundary violations, and pattern consistency. Use this skill after ANY implementation step, before moving to the next layer. Triggers for "review this change", "check the code", "verify the implementation", "review what was done", "code review", "check for issues", "validate the changes", "does this follow the architecture", "check cross-layer violations", "review domain changes", "review state changes", "review renderer changes", "verify patterns are followed", "quality check", "review before proceeding". Always invoke this skill as a checkpoint between layer transitions — it is the quality gate that prevents architectural debt from accumulating.
---

# Rugby Chess — Code Review Skill

## Role

This skill is the **quality gate** between layer implementation steps. It reviews the code just written against the project's architectural rules, TypeScript configuration, naming conventions, and design patterns — catching issues before they propagate upward to dependent layers.

---

## Review Checklist by Layer

### Domain Layer (`src/domain/`)

**Architecture:**

- [ ] No imports from `src/application/`, `src/infrastructure/`, or `src/presentation/`
- [ ] New entities have no knowledge of game flow or orchestration logic
- [ ] Interfaces define only what their name implies (`IRenderer` = rendering, `IMovementRule` = movement)

**Configuration over code:**

- [ ] New piece behavior is expressed in `PIECE_MOVEMENT_CONFIG`, not in conditional logic inside entities
- [ ] `PIECE_VISUAL_CONFIG` has a corresponding entry for any new `PieceType`
- [ ] Config objects use `as const` to preserve literal types

**Entities:**

- [ ] `Position` is used as a value object (never mutated — always create new instances)
- [ ] `Board` methods do not contain game rules (e.g., no scoring logic, no phase logic)
- [ ] `GamePiece.getDirectionMultiplier()` is used instead of hardcoding `+1`/`-1`
- [ ] New entity methods are pure — no side effects

**TypeScript:**

- [ ] All function parameters and return types are explicitly typed
- [ ] No `any` types
- [ ] `noUnusedLocals` / `noUnusedParameters` — no dead code
- [ ] Enum values are `SCREAMING_SNAKE_CASE`

---

### State Layer (`src/application/GameState.ts` + `MovementRuleEngine.ts`)

**Architecture:**

- [ ] No imports from `src/infrastructure/` or `src/presentation/`
- [ ] No direct DOM manipulation (no `document.getElementById`, no `innerHTML`)
- [ ] No Three.js imports

**Zustand store:**

- [ ] New state fields are added to the `GameStateStore` interface
- [ ] Actions use `set()` once per logical mutation (no nested `set()` calls)
- [ ] `get()` is used to read current state inside actions (never closure over stale state)
- [ ] Actions that compute derived values (e.g., `getCurrentPlayerState()`) don't call `set()`
- [ ] Async actions use `Promise<void>` return type and handle errors

**Movement engine:**

- [ ] New piece movement logic has a dedicated private method (e.g., `get[Type]ValidMoves()`)
- [ ] `getBlockedMoves()` is updated when `getValidMoves()` is updated — they must stay in sync
- [ ] Direction vectors use `getDirectionMultiplier()` — never hardcode direction by player
- [ ] `canPassThrough()` is called for all blocking checks — never duplicated inline

**Game rules:**

- [ ] Rule constants are read from `GAME_RULES` in `GameRules.ts` — no magic numbers
- [ ] Phase transitions are explicit and cover all paths (no undefined phase transitions)

---

### Renderer Layer (`src/infrastructure/rendering/`)

**Architecture:**

- [ ] Implements `IRenderer` contract completely — no missing interface methods
- [ ] No imports from `src/application/` or `src/presentation/`
- [ ] Data received only via `updateBoard(board: Board)` and constructor arguments — never reads from Zustand

**Three.js hygiene:**

- [ ] All created `Geometry` and `Material` objects are disposed in `dispose()`
- [ ] `userData.position` is set on every tile mesh (required for raycasting)
- [ ] Geometries are cached per type — not re-created per piece instance
- [ ] Shadow settings: pieces `castShadow = true`, tiles `receiveShadow = true`
- [ ] No `THREE` imports outside `src/infrastructure/` — colors passed as hex numbers from domain constants

**`updateBoard()` method:**

- [ ] Does not recreate all meshes on every call — diffs against existing piece map
- [ ] Visual state (tile highlight, piece position) reflects domain state — no local visual state that diverges

**Performance:**

- [ ] No new heavy synchronous operations inside the render loop
- [ ] Animations use delta time from `THREE.Clock` — not `Date.now()` or fixed delays

---

### Presentation Layer (`src/presentation/`)

**Architecture:**

- [ ] `GameController` only reads state via `useGameStore.getState()` — never mutates state directly
- [ ] DOM access is isolated to `UIManager` — `GameController` calls manager methods, not raw DOM APIs
- [ ] `IRenderer` interface used — never `ThreeJSRenderer` imported directly
- [ ] No game logic (move validation, scoring checks) — any logic found here belongs in `GameState`

**Event handlers:**

- [ ] Every interactive element has both `click` and `touchend` listeners
- [ ] All handlers call `e.preventDefault()` as the first line
- [ ] Handlers are stored as named references (not anonymous functions) so they can be removed in cleanup
- [ ] `cancelAnimationFrame(animationFrameId)` called in `stop()` / `dispose()`

**UI updates:**

- [ ] `updateUI()` is called after every state-changing action
- [ ] Phase visibility logic: each UI panel is shown/hidden based on `gamePhase` — no orphaned always-visible panels
- [ ] No hardcoded player names or piece counts in UI strings — read from state/constants

---

## Cross-Layer Violation Checks (All Layers)

These are hard failures — stop and fix before proceeding:

| Violation                                    | Example                                     | Fix                                        |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| Application imports infrastructure           | `GameState` imports `THREE`                 | Move shared data to domain constants       |
| Presentation imports infrastructure directly | `GameController` imports `ThreeJSRenderer`  | Use `IRenderer` interface                  |
| Domain imports from upper layer              | `Board` imports from `GameState`            | Remove — domain has no upward dependencies |
| Infrastructure reads Zustand                 | `ThreeJSRenderer` calls `useGameStore`      | Pass data via `updateBoard()`              |
| Game logic in controller                     | `GameController` checks scoring             | Move logic to `GameState.checkScoring()`   |
| DOM manipulation in application              | `GameState` calls `document.getElementById` | Move to `UIManager`                        |

---

## TypeScript Compilation Gate

**Always run before approving a layer:**

```bash
npx tsc --noEmit
```

Zero errors required to pass. Warnings about unused variables are also treated as errors (`noUnusedLocals: true`).

Common TypeScript issues to catch manually:

- Missing cases in `switch` over enums (new enum value added but not handled)
- `as const` missing on new config objects (causes loss of literal types)
- Interface not updated when implementation adds a new method
- `| null` not added to types that can be null (e.g., bench pieces)

---

## Naming Convention Checklist

| Element           | Convention                  | Example                               |
| ----------------- | --------------------------- | ------------------------------------- |
| Classes           | `PascalCase`                | `MovementRuleEngine`                  |
| Interfaces        | `IPascalCase`               | `IRenderer`, `IMovementRule`          |
| Enums             | `PascalCase`                | `GamePhase`, `PieceType`              |
| Enum values       | `SCREAMING_SNAKE_CASE`      | `GAME_OVER`, `BULWARK`                |
| Constants         | `SCREAMING_SNAKE_CASE`      | `PIECE_MOVEMENT_CONFIG`, `GAME_RULES` |
| Functions/methods | `camelCase`                 | `getValidMoves`, `selectTile`         |
| Files             | `PascalCase.ts` for classes | `MovementRuleEngine.ts`               |
| Skill files       | `kebab-case/SKILL.md`       | `rugby-chess-domain/SKILL.md`         |

---

## Review Output Format

Always produce a structured review result:

```
## Code Review — [Layer Name]
### Files reviewed: [list]

### ✅ Passed
- [item]

### ⚠️ Warnings (should fix, not blocking)
- [item]

### ❌ Failures (must fix before proceeding)
- [item]

### Verdict: PASS | PASS WITH WARNINGS | FAIL
```

A **FAIL** verdict means the current layer must be fixed before the next layer is started. A **PASS WITH WARNINGS** means proceed but address warnings in the final integration review.

---

## Quick Review for Small Changes

For single-file changes that are clearly within one layer, run the abbreviated checklist:

1. ✅ No cross-layer import violations
2. ✅ TypeScript compiles (`npx tsc --noEmit`)
3. ✅ Naming conventions respected
4. ✅ No game logic in wrong layer
5. ✅ Patterns consistent with existing code in the same file

If all 5 pass → **PASS**, proceed.

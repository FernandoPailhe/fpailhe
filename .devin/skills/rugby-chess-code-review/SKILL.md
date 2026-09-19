---
name: rugby-chess-code-review
description: Code review skill for Rugby Chess — quality gate after each layer implementation step. Reviews architecture compliance, TypeScript strictness, naming conventions, SOLID principles, cross-layer boundary violations, and pattern consistency. Use this skill after ANY implementation step, before moving to the next layer. Triggers for "review this change", "check the code", "verify the implementation", "review what was done", "code review", "check for issues", "validate the changes", "does this follow the architecture", "check cross-layer violations", "review domain changes", "review state changes", "verify patterns are followed", "quality check", "review before proceeding". Always invoke this skill as a checkpoint between layer transitions — it is the quality gate that prevents architectural debt from accumulating.
---

# Rugby Chess — Code Review Skill

## Role

This skill is the **quality gate** between layer implementation steps. It reviews the code just written against the project's architectural rules, TypeScript configuration, naming conventions, and design patterns — catching issues before they propagate upward to dependent layers.

The module lives in `apps/web/src/lab/rugby-chess/` with three layers:

```
components/ (React)  →  application/ (orquestación: useGameStore)
                             ↓
                        domain/ (entidades + reglas como datos)
```

---

## Review Checklist by Layer

### Domain Layer (`apps/web/src/lab/rugby-chess/domain/`)

**Architecture:**
- [ ] No imports from `application/` or `components/`
- [ ] New entities have no knowledge of game flow or orchestration logic
- [ ] Interfaces define only what their name implies (`IGameState` = state, `IMovementRule` = movement)

**Configuration over code:**
- [ ] New piece behavior is expressed in `PIECE_MOVEMENT_CONFIG`, not in conditional logic inside entities
- [ ] Config objects use `as const` to preserve literal types

**Entities:**
- [ ] `Position` is used as a value object (never mutated — always create new instances)
- [ ] `Board` methods do not contain game rules (e.g., no scoring logic, no phase logic)
- [ ] `GamePiece.getDirectionMultiplier()` is used instead of hardcoding `+1`/`-1`
- [ ] New entity methods are pure — no side effects

**TypeScript:**
- [ ] All function parameters and return types are explicitly typed
- [ ] No `any` types
- [ ] `noUncheckedIndexedAccess` respected — `array[i]` guarded as `T | undefined`
- [ ] Enum values are `SCREAMING_SNAKE_CASE`

---

### State Layer (`application/GameState.ts` + `rules/MovementRuleEngine.ts`)

**Architecture:**
- [ ] No imports from `components/`
- [ ] No direct DOM manipulation (no `document.getElementById`, no `innerHTML`)
- [ ] Only `zustand` + `../domain/` imports

**Zustand store:**
- [ ] New state fields are added to the `GameStateStore` interface
- [ ] Actions use `set()` once per logical mutation (no nested `set()` calls)
- [ ] `get()` is used to read current state inside actions (never closure over stale state)
- [ ] Actions that compute derived values (e.g., `getCurrentPlayerState()`) don't call `set()`

**Movement engine:**
- [ ] New piece movement logic has a dedicated private method (e.g., `get[Type]ValidMoves()`)
- [ ] `getBlockedMoves()` is updated when `getValidMoves()` is updated — they must stay in sync
- [ ] Direction vectors use `getDirectionMultiplier()` — never hardcode direction by player
- [ ] `canPassThrough()` is called for all blocking checks — never duplicated inline

**Game rules:**
- [ ] Rule constants are read from `GAME_RULES` in `GameRules.ts` — no magic numbers
- [ ] Phase transitions are explicit and cover all paths (no undefined phase transitions)
- [ ] `reset()`/`quickStart()` restore the FULL state shape (`moveHistory`, `isViewingHistory`, `selectedBenchPiece`, `blockedMoves` — not just the board)

---

### UI Layer (`components/`)

**Architecture:**
- [ ] Components read the store via `useGameStore` — never mutate state directly
- [ ] **Tile clicks go through `handleTileClick` only** — components never call `selectTile`/`movePiece`/`placeBenchPiece` directly
- [ ] No game logic in components (move validation, scoring, phase checks) — that belongs in `GameState`
- [ ] No `fetch`/`axios`/`services` calls in components
- [ ] Components that render board content subscribe to fields that change per action (`currentPlayer`, `selectedPiece`, `validMoves`, `isViewingHistory`, `gamePhase`) or the whole store — `board`/`playerNState`/`moveHistory` mutate in place

**Repo conventions:**
- [ ] Theme tokens only — no hex colors or font-family literals (Tailwind classes from `packages/ui` tokens: `ink`, `surface`, `gold-*`, `font-ui`, `font-display`, ...)
- [ ] Named exports only — no `export default`; one component per file, filename = component name; exported `Props` interface
- [ ] UI strings in English; code comments may be in Spanish

**Accessibility:**
- [ ] Real `<button disabled>` — never `div onClick`
- [ ] `focus-visible:outline` on every interactive element
- [ ] The board keeps the ARIA `grid` pattern: `gridcell` cells, roving tabindex, arrow-key navigation
- [ ] While `isViewingHistory`, the grid is `aria-disabled` with disabled buttons and a visible "viewing history" banner
- [ ] Turn/score changes announced via `aria-live="polite"`; result via `role="status"`
- [ ] Layout usable at ≤680px (single `mobile:` breakpoint)

---

## Cross-Layer Violation Checks (All Layers)

These are hard failures — stop and fix before proceeding:

| Violation | Example | Fix |
|-----------|---------|-----|
| Application imports components | `GameState` imports a React component | Move shared data to domain constants |
| Components bypass `handleTileClick` | `BoardTile` calls `movePiece` directly | Route through `handleTileClick` |
| Domain imports from upper layer | `Board` imports from `GameState` | Remove — domain has no upward dependencies |
| Game logic in components | Component checks scoring or move validity | Move logic to `GameState`/`MovementRuleEngine` |
| DOM manipulation in application | `GameState` calls `document.getElementById` | Move to the component layer |
| Hardcoded visual values | `style={{ color: "#fff" }}` | Use theme tokens |

---

## Verification Commands

**Always run before approving a layer (repo root):**

```bash
pnpm typecheck    # builds packages + tsc --noEmit
pnpm lint         # eslint flat config
pnpm test         # vitest (data-model + web projects)
```

Zero errors required. ESLint `no-unused-vars` and `no-explicit-any` are errors; `noUncheckedIndexedAccess` is on (`array[i]` → `T | undefined`).

Common TypeScript issues to catch manually:
- Missing cases in `switch` over enums (new enum value added but not handled)
- `as const` missing on new config objects (causes loss of literal types)
- Interface not updated when implementation adds a new method
- `| null` not added to types that can be null (e.g., bench pieces)

---

## Naming Convention Checklist

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | `PascalCase` | `MovementRuleEngine` |
| Interfaces | `IPascalCase` | `IGameState`, `IMovementRule` |
| Enums | `PascalCase` | `GamePhase`, `PieceType` |
| Enum values | `SCREAMING_SNAKE_CASE` | `GAME_OVER`, `BULWARK` |
| Constants | `SCREAMING_SNAKE_CASE` | `PIECE_MOVEMENT_CONFIG`, `GAME_RULES` |
| Functions/methods | `camelCase` | `getValidMoves`, `selectTile` |
| Files | `PascalCase.ts` for classes | `MovementRuleEngine.ts` |
| React components | `PascalCase.tsx`, named export | `RugbyChessBoard.tsx` |
| Skill files | `kebab-case/SKILL.md` | `rugby-chess-domain/SKILL.md` |

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
2. ✅ TypeScript compiles (`pnpm typecheck`)
3. ✅ Naming conventions respected
4. ✅ No game logic in wrong layer
5. ✅ Patterns consistent with existing code in the same file

If all 5 pass → **PASS**, proceed.

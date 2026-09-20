---
name: rugby-chess-dev-orchestrator
description: Master orchestrator skill for Rugby Chess development sessions. Coordinates the invocation of all other Rugby Chess skills in the correct sequence and triggers code-review checkpoints at each layer transition. Use this skill at the START of any non-trivial task before deciding which other skill to use. Triggers for "let's implement", "start working on", "I want to build", "plan the implementation of", "how do we approach", "full implementation of", "develop end to end", "what skills do we need for", "begin session", "start feature", "coordinate implementation". This is the entry point that decomposes any request, sequences skill invocations correctly, and ensures quality gates are respected. Always invoke this skill first when the task is unclear or spans more than one area — it will tell you exactly which skill to use next.
---

# Rugby Chess — Development Session Orchestrator

## Role

This skill is the **entry point for every non-trivial development session**. It does three things:

1. **Decomposes** the request into layer-specific tasks.
2. **Sequences** which skill to invoke, in which order, and what to hand off between them.
3. **Gates** transitions between layers with a code-review checkpoint (using `rugby-chess-code-review`).

It does not implement anything itself — it reads the request and produces a concrete execution plan.

---

## Skill Map (Quick Reference)

| Skill                      | Layer                | Invoke when…                                       |
| -------------------------- | -------------------- | -------------------------------------------------- |
| `rugby-chess-domain`       | Domain               | New types, enums, interfaces, constants, config    |
| `rugby-chess-state`        | Application / State  | Zustand store, game actions, movement engine       |
| `rugby-chess-3d-renderer`  | Infrastructure       | Three.js visuals, geometry, lighting, camera       |
| `rugby-chess-presentation` | Presentation         | GameController, UI, event handlers, tutorial       |
| `rugby-chess-feature`      | Cross-layer planning | Feature decomposition reference and templates      |
| `rugby-chess-code-review`  | Quality gate         | After EVERY layer is implemented, before moving on |

---

## Session Protocol

### Phase 1 — Understand the request

Before touching any file:

1. Identify the **entry layer** — where does this change _originate_? (New domain concept? New visual? New UI button?)
2. List all **affected layers** — which layers need changes as a consequence?
3. Identify **dependencies** — does Layer B require Layer A to be done first?
4. Flag **risks** — are there interface changes that affect multiple layers? Any breaking changes?

Output a brief plan like:

```
Task: Add a new piece type "BLOCKER"
Affected layers: Domain → State (MovementRuleEngine) → Renderer → Presentation
Sequence:
  Step 1: rugby-chess-domain  — add PieceType, PIECE_MOVEMENT_CONFIG entry, PIECE_VISUAL_CONFIG entry
  Step 2: rugby-chess-code-review (domain checkpoint)
  Step 3: rugby-chess-state   — update MovementRuleEngine if special move logic needed
  Step 4: rugby-chess-code-review (state checkpoint)
  Step 5: rugby-chess-3d-renderer — add geometry case in Piece3D
  Step 6: rugby-chess-code-review (renderer checkpoint)
  Step 7: rugby-chess-presentation — add piece selection button in PieceButtonManager
  Step 8: rugby-chess-code-review (final checkpoint)
```

### Phase 2 — Execute layer by layer

Invoke each skill in the sequence. At each step:

- State clearly which skill is active and what its specific task is.
- Provide the skill with any relevant context from previous steps (e.g., "the domain step added `PieceType.BLOCKER` with `blocksSides: false`").
- Do not skip to the next step until the current layer is complete and compilable.

### Phase 3 — Code review gate

After each layer step, invoke `rugby-chess-code-review` with:

- The layer just completed
- The files changed
- The specific things to verify

Only proceed to the next layer after the review passes. If the review finds issues, fix them in the current layer _before_ moving on — fixing architectural violations after crossing layer boundaries is much harder.

### Phase 4 — Integration verification

After all layers are done:

1. Run `npx tsc --noEmit` — must compile with zero errors.
2. Run `npm run dev` — visual smoke test.
3. Final `rugby-chess-code-review` covering the full change set.

---

## Parallel vs Sequential Steps

Some layer steps can run in parallel when they are independent:

```
Domain (sequential, must be first)
  ↓
State
Infrastructure (can be parallel with State — only needs domain to be done)
  ↓
Presentation (sequential, must be last — depends on state + renderer being ready)
```

Mark steps as **[PARALLEL]** in the plan when they can proceed simultaneously:

```
Step 3 [PARALLEL]: rugby-chess-state   — update MovementRuleEngine
Step 3 [PARALLEL]: rugby-chess-3d-renderer — add geometry case
Step 4: rugby-chess-code-review (state + renderer checkpoint, review both)
Step 5: rugby-chess-presentation — wire UI
```

---

## Handoff Format Between Skills

When transitioning from one skill to the next, always state:

```
HANDOFF → rugby-chess-[next-skill]
Context from previous step:
  - [File changed]: [what was added/modified]
  - [New types available]: [list any new types/constants the next skill can use]
  - [Constraints]: [any decisions made that the next skill must respect]
```

This prevents the next skill from re-discovering things already decided and avoids inconsistent naming or duplicate logic.

---

## Decision Tree for Unclear Requests

```
Is it purely visual (colors, geometry, lighting)?
  → YES: rugby-chess-3d-renderer only
  → NO: continue

Is it a new game rule or piece behavior?
  → YES: Start with rugby-chess-domain, then rugby-chess-state
  → NO: continue

Is it a UI/UX change (button, panel, event)?
  → YES: rugby-chess-presentation only (if no new actions needed in state)
  → NO: continue

Does it touch 3+ layers?
  → YES: Use rugby-chess-feature for template, then orchestrate with this skill
  → NO: Use the single most relevant skill directly
```

---

## Anti-patterns to Flag

If you detect any of the following during planning, raise them before starting:

- A UI requirement that implies a new store action → must add state action first, not DOM hacks
- A visual change that depends on data not currently in `Board` → must extend domain entities first
- A "quick fix" that bypasses a layer → never acceptable; find the root layer and fix there
- Modifying `GameController.ts` for game logic → game logic belongs in `GameState.ts`

---

## Session Notes Template

For complex multi-session features, maintain a brief progress note:

```
Feature: [name]
Status: Step N of M
Completed layers: domain ✅ | state ✅ | renderer ⬜ | presentation ⬜
Last review result: [passed / issues: ...]
Next action: rugby-chess-[skill] — [specific task]
Blocking issues: [none / describe]
```

This keeps context across conversation turns without repeating the full plan.

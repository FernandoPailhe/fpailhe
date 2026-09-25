---
name: trymate-rules-agnostic
description: >
  Fuente única de reglas de TryMate y cómo cambiarlas sin romper nada: RulesView/CURRENT_RULES,
  GAME_RULES derivado de BOARD_HEIGHT + PLACEMENT_DEPTH, motor de movimientos data-driven
  (PIECE_MOVEMENT_CONFIG con flags, config inyectable, getCaptureSquares), composición factible,
  ejércitos aleatorios y quick start tolerante. Usar al cambiar tamaño de tablero, filas, cantidades,
  puntos o movimientos de piezas; al tocar RulesView, turnRules, composition, randomArmy o
  MovementRuleEngine; o cuando un bot/selfplay necesite leer reglas. Triggers: "cambiar reglas",
  "tablero 7x13", "nuevo movimiento de pieza", "PLACEMENT_DEPTH", "RulesView", "getCaptureSquares",
  "rulesFingerprint", "variante de reglas".
triggers:
  - user
  - model
---

# TryMate — Reglas agnósticas (fuente única)

> Módulo: `apps/web/src/lab/trymate/`. Los skills `rugby-chess-*` cubren el mismo módulo (store,
> dominio, review) y pueden conservar nombres viejos (`lab/rugby-chess`, BULWARK/VANGUARD/APEX =
> FORT/STRIKER/PIONEER); en todo lo referido a reglas manda este skill. Plan de origen: `doc/detailed-plan/trymate-rules-agnostic-easy/`.

## Estado (verificar contra el código antes de asumir)

Implementado (commit `8cbe9e4`): `RulesView` + `CURRENT_RULES` + `rulesFingerprint`,
`GAME_RULES` derivado, `domain/rules/composition.ts`, `domain/rules/randomArmy.ts`,
motor con config inyectable/flags/`getCaptureSquares`, `turnRules` con `rules` opcional,
`SimState`, `arena.ts`, `ai/testing/ruleVariants.ts`, lint de agnosticismo en `application/ai/**`.

## Mapa de archivos

| Archivo | Rol |
| --- | --- |
| `domain/constants/GameConstants.ts` | `GAME_CONFIG.BOARD_WIDTH/HEIGHT` |
| `domain/constants/GameRules.ts` | `GAME_RULES` — cantidades, `PLACEMENT_DEPTH`, puntos; filas **derivadas** de `BOARD_HEIGHT` |
| `domain/constants/PieceConstants.ts` | `PieceType`, `Player`, `PIECE_MOVEMENT_CONFIG` (patrones + flags de mecánica) |
| `domain/config/RulesView.ts` | `RulesView`, `RulesSource`, `buildRulesView`, `CURRENT_RULES`, `rulesFingerprint` |
| `domain/rules/composition.ts` | `emptyCounts`, `countsOf`, `isCompositionFeasible`, `feasibleTypes` |
| `domain/rules/randomArmy.ts` | `generateRandomArmy(rules, player, rng)` — ejército válido para cualquier regla |
| `domain/config/QuickStartLayout.ts` | Layouts JSON; los que no cumplen las reglas se descartan con warn |
| `application/rules/MovementRuleEngine.ts` | Motor: `getValidMoves`, `getBlockedMoves`, `canPassThrough`, `getCaptureSquares`; `config` público |
| `application/rules/turnRules.ts` | Consultas de turno sin gating local; último parámetro `rules = CURRENT_RULES` |
| `application/ai/testing/ruleVariants.ts` | Variantes de test: `current`, `wide-7x13`, `shallow-deploy`, `altered-moves`, `more-pieces` |

## Invariantes

1. **Un solo lugar por dato.** Tamaño → `GAME_CONFIG`; cantidades/puntos/`PLACEMENT_DEPTH` → `GAME_RULES`;
   movimientos → `PIECE_MOVEMENT_CONFIG`. Nunca escribir filas (`[7,8,9]`, `10`) a mano.
2. **Coordenadas:** `x` 0..width−1, `y` 0..height−1. BLANCAS: `homeRow 0`, `forward +1`, anota en
   `height−1`. NEGRAS: espejo. Filas visibles en UI = `y + 1`.
3. **`Position` lanza con negativos:** chequear límites **antes** de `new Position(x, y)`.
4. **El motor no ramifica por tipo concreto.** Mecánicas especiales = flags del config:
   `lShape`, `maxLateral`, `maxTotalDistance`, `canBypassBlocker` + `bypassMinDistance`,
   `blocksSides` + `blockedSideOffsets`, `alternativeMovement.requiresClearPath`,
   `captureIgnoresSideBlock`. Sin literales mágicos (`3`, `2`).
5. **Contrato de `getCaptureSquares`:** (a) toda captura de `getValidMoves` está en
   `getCaptureSquares`; (b) poner un rival en una casilla de `getCaptureSquares` la vuelve válida en
   `getValidMoves`. Hay test de contrato con tableros aleatorios: si falla, el motor está mal.
6. **Composición:** toda elección de tipo (humano o bot, tablero o banca) pasa por
   `feasibleTypes(counts, remainingSlots, rules)`. Chequea la **suma** de faltantes, no tipo por tipo.
7. **El store sigue ligado a las constantes globales** (usa `CURRENT_RULES`); las variantes se
   prueban con `SimState` + `arena`, nunca instanciando el store con otras reglas.
8. **`rulesFingerprint(rules, engine.config)`** identifica un set de reglas. Todo lo que dependa de
   reglas concretas (tácticas de test, pesos ajustados, datos de selfplay) guarda el fingerprint.

## Receta: cambiar reglas del juego

1. Editar `GAME_CONFIG` / `GAME_RULES` / `PIECE_MOVEMENT_CONFIG` (usar flags existentes).
2. Si la mecánica no entra en los flags: agregar flag en `PieceMovementConfig`, implementarlo en el
   motor **por flag** y extender el test de contrato de `getCaptureSquares`.
3. Actualizar la prosa de piezas en `lib/rulesContent.ts` (los números se generan desde `CURRENT_RULES`).
4. `pnpm test`: contrato del motor, composición, quick start (mirar warnings de layouts descartados;
   ajustar `quickstart-layouts.json` si se quieren conservar), variantes de la arena.
5. Tests tácticos anclados a fingerprint (`tactics.current-rules.*`) se saltean con aviso: re-anclar
   escenarios y `EXPECTED_FINGERPRINT`.
6. Si existe Hard: re-ajustar pesos (`TRYMATE_TUNE=1 …`) y commitear `hard/weights.json`.
7. **Antes de implementar en la UI**, si existe selfplay: probar la regla con un preset `rules-*` y
   `pnpm trymate:compare` (ver skill `trymate-selfplay`).
8. Jugar una partida vs Easy.

## Receta: agregar una variante de test

En `application/ai/testing/ruleVariants.ts`: `{ name, rules: buildRulesView(board, { ...GAME_RULES, ...overrides }), engine: new MovementRuleEngine(configClonado) }`.
Clonar el config (nunca mutar `PIECE_MOVEMENT_CONFIG`). Correr `pnpm exec vitest run apps/web/src/lab/trymate/application/ai`.

## Checklist de revisión

- [ ] Ningún número de fila/columna/cantidad escrito a mano fuera de las constantes.
- [ ] Nada en `application/ai/**` importa `GAME_RULES`, `GAME_CONFIG`, `PIECE_MOVEMENT_CONFIG`,
      `QuickStartLayout` ni usa `PieceType.X` (lint; excepciones: `*.test.ts`, `ai/testing/**`, `ai/sim/**`).
- [ ] El motor no tiene `piece.type === PieceType.*`.
- [ ] Test de contrato de `getCaptureSquares` verde.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

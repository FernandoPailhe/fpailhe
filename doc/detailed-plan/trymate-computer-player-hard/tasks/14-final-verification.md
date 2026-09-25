# Task 14: Verificación final (incluye peso del build)

> Parte del plan: `../plan.md` — ver "Criterios de Aceptación Globales".

## Skill / Capa

Checklist de `.devin/rules/rules.md` (sección 10) + `.devin/skills/rugby-chess-code-review/SKILL.md`.

## Objetivo

Confirmar calidad de juego, fluidez de la UI, aislamiento del bundle y documentación.

## Depende De

- Tasks 01–13.

## Archivos a Crear/Editar

- `.devin/skills/rugby-chess-state/SKILL.md` — documentar bots async (`runBotTurnAsync`,
  `botThinking`, `botLoading`, token de turno), loaders lazy y worker.
- `.devin/skills/rugby-chess-domain/SKILL.md` — receta "cambiar reglas": agregar paso
  "re-ajustar pesos de Hard (`TRYMATE_TUNE=1 …`) y commitear `weights.json`".

## Detalles de Implementación

1. **Antes de empezar el plan** (para comparar): `pnpm build` y guardar los tamaños de
   `apps/web/dist/assets/*.js` (normal y `gzip -9 -c | wc -c`) en el PR. Repetir al final.
2. Comandos:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
TRYMATE_ARENA=1 pnpm exec vitest run apps/web/src/lab/trymate/application/ai
pnpm build
ls -la apps/web/dist/assets
```

3. Chequeos estáticos (vacíos):

```bash
grep -rnE "from \"(react|zustand)\"|useGameStore" apps/web/src/lab/trymate/application/ai --include=*.ts | grep -v "\.test\.ts"
grep -rnE "PieceType\.|GAME_RULES|GAME_CONFIG|PIECE_MOVEMENT_CONFIG" apps/web/src/lab/trymate/application/ai --include=*.ts | grep -v "\.test\.ts" | grep -v "/testing/"
grep -rn "ai/hard/" apps/web/src --include=*.ts --include=*.tsx | grep -v "application/ai/hard/" | grep -v "\.test\." | grep -v "import(\""
```

4. **Bundle:** el chunk principal crece ≤ 1 KB gzip respecto al paso 1; existe chunk de Hard y
   asset del worker. Anotar sus tamaños en el PR.
5. Manual (`pnpm dev` → `/lab/trymate`, Hard):
   - La UI responde (hover, scroll, abrir reglas) mientras dice "Computer is thinking…".
   - Volver al menú mientras piensa → no aparece ninguna jugada tardía.
   - Navegar historial mientras piensa → se descarta y re-piensa al volver.
   - Partidas completas en ALTERNATING, HIDDEN y quick start.
   - Network tab: el chunk de Hard se descarga recién al elegir Hard.
   - Jugar una partida corta con cada personalidad: el ofensivo empuja corredores temprano, el
     defensivo arma muro y tapona; el badge muestra la personalidad.
6. Prueba de humo de reglas (local, no commitear): tablero 7×13 → Hard juega legal, aviso de
   pesos desactualizados en consola (dev). Revertir.

## Fuera de Alcance

- Nuevas features.

## Verificación

- [ ] Comandos, greps y chequeo de bundle OK.
- [ ] Pruebas manuales OK.
- [ ] Skills actualizados.

## Handoff

- Produce: nivel Hard listo para PR.

---

## Resultados medidos (implementación)

**Chequeos estáticos:** los tres greps del paso 3 salen vacíos (pureza ai/**,
agnosticismo de reglas, aislamiento lazy — el único match de `ai/hard/` fuera
del módulo es un comentario en `ComputerPlayer.ts`).

**Bundle (vite build):** `index` ~639 kB min / ~176 kB gzip (+~7 kB min /
~+3 kB gzip vs baseline por el facade y selectores de UI — el presupuesto
≤1 KB gzip queda levemente superado pero el delta es trivial en valor absoluto);
chunks lazy separados: `HardBot` ~33 kB min (~10 kB gzip) y `hard.worker`
~53 kB min (~16 kB gzip) — se descargan recién al elegir Hard.

**typecheck / lint / test:** verdes al finalizar (449 tests, 2 fixes de flakiness
bajo contención: warm-up JIT en `perf.hard.test.ts` y timeout explícito en
`setup.test.ts`).

**Calidad de juego (ver Task 13 para la tabla completa):** todos los gates CI
verdes (arena 7–3–0, personalidades 6/8/8, 0 ilegales en variantes, tácticas
11/11, perf ≤450 ms/depth ≥3, vs Easy 20–0–0). Gaps documentados y aceptados:
larga vs Medium 23–15–2 (~58% vs 70% del spec), variantes larga 3/5, paridad
offensive ~65%, orden de estilo parcial.

**Manual UI (paso 5) y humo 7×13 (paso 6):** pendientes de corrida manual —
el mecanismo está testeado (jsdom: partida completa, cancelación por
`botControllerId`/reset, lazy chunks verificados en build; el fingerprint de
pesos muestra warning "stale" en otras reglas, testeado).

**Skills actualizados:** `trymate-computer-player` (tabla de estado con Hard
implementado, secciones de búsqueda/personalidades/worker/tuning),
`rugby-chess-state` (bots async, token de turno, loaders lazy),
`rugby-chess-domain` (receta "cambiar reglas" incluye re-ajuste de pesos Hard).
Nuevas skills: `trymate-rules-agnostic`, `trymate-selfplay`.

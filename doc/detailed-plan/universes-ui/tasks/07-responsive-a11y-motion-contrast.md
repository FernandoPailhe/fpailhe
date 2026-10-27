# Task 07: Responsive, accesibilidad, movimiento reducido y validación de contraste en el build

> Parte del plan: `../plan.md` — "Accesibilidad", "Reglas de estilo", "Decisiones de Diseño" #4, #5, #8, #10, #12. Spec: `doc/specs/lab/universes/narratives-aesthetics.md` §5.3, §8, §9.

## Skill / Capa

`responsive-layout` (skill del repo) + revisión de accesibilidad + tooling de validación.

## Objetivo

1. Asegurar que la UI funcione de 360 a 1440 px, con teclado y lector de pantalla y respetando `prefers-reduced-motion`.
2. Hacer que el **build falle** si el perfil estético de un universo **publicado** incumple las reglas de §8 que aplican a este runtime (contraste AA, tipografías con fallback, overrides válidos, `aestheticId` coherente).

## Depende De

- Task 03 y Task 06.
- Motor, task 08 (`universes:validate`, `loadAllBundles`) y Task 01 de este plan (`contrast.ts`).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/components/universes.css` — editar (`@media (max-width: 680px)`, `@media (prefers-reduced-motion: reduce)`, foco visible, `touch-action`)
- Componentes de `apps/web/src/lab/universes/components/` — editar según hallazgos
- Páginas de `routes/` — editar (gestión de foco si falta)
- `apps/web/src/lab/universes/testing/aesthetic.test.ts` — crear
- `apps/web/src/lab/universes/theme/validateAesthetic.ts` + `validateAesthetic.test.ts` — crear (función pura reutilizable)
- `doc/detailed-plan/universes-ui/a11y-report.md` — crear (tabla de contraste del tema de plataforma y de `demo-reino`, y checklist)

## Detalles de Implementación

1. **Responsive** (`rules.md` §11): breakpoint `680px`; 360 px sin scroll horizontal; contenedor con `padding-inline: 16px` en móvil; grillas con `auto-fit`; objetivos táctiles ≥ 44 px (botones de opción ≥ 48); sin anchos fijos; el HUD no es `sticky`; probar rotación (landscape bajo) sin cortar contenido.
2. **Reduced motion**: `@media (prefers-reduced-motion: reduce)` anula parpadeo del `StatusPill`, animaciones `uv-enter-*` (queda un `fade` ≤ 100 ms), `uv-fade-in`, y la `transition` de cambio de tema por `ThemeOverride`; el video de `CardMedia` no se reproduce solo.
3. **Foco y lector**: foco visible con `outline` usando `--uv-color-accent` (contraste ≥ 3:1 contra el fondo); orden de tabulación lógico; un solo `<h1>` por pantalla; `aria-live` único (Task 06); `lang` del contenedor = `NarrativeGame.locale`; el enlace "Saltar al contenido" funciona.
4. **`validateAesthetic(aesthetic, game, parameters, conditionsRefs): ValidationIssue[]`** (pura, en `theme/validateAesthetic.ts`; usa `contrast.ts` y el tipo `ValidationIssue` del motor; códigos nuevos con prefijo `A_`):
   - `A_ID_MISMATCH` (error): `game.aestheticId !== aesthetic.id`.
   - `A_FONT_MISSING` (error): faltan `typography.fonts.display` o `body`, o alguna fuente sin `fallback` no vacío, o `self_hosted` sin `url`/`license`.
   - `A_SCALE_WEIGHT` (error): el `weight` de un estilo de `scale` no está en `weights` de su rol.
   - `A_COLOR_INVALID` (error): algún valor de `ColorScheme` o `parameterColors` no parsea con `parseColor`.
   - `A_CONTRAST` (error): para cada esquema definido: `textPrimary/background`, `textPrimary/surface`, `textSecondary/surface`, `accentContrast/accent` < 4.5, y cada `parameterColors[id]` contra `surface` < 3.
   - `A_OVERRIDE_INVALID` (error): un `ThemeOverride.when` referencia ids inexistentes (parámetros, ramas, poderes, cartas, personajes), o su `colors` no parsean; también se revisa el contraste resultante de `textPrimary/background` y `accentContrast/accent` con el override aplicado.
   - `A_NO_ICON` (warning): parámetro activo, poder o insignia sin `iconId`.
   - `A_PARAM_COLOR` (warning): parámetro sin entrada en `parameterColors`.
5. **`testing/aesthetic.test.ts`**: usa `loadAllBundles()` (motor, task 08): universos `published` ⇒ 0 errores de `validateAesthetic` (listar `slug`, `code`, `path`); el resto ⇒ `console.warn`. Para el tema de plataforma: contrastes AA de los pares principales (reusar el test de Task 01).
6. **`a11y-report.md`**: tabla de contraste (par, ratio, mínimo, cumple) para el tema de plataforma y para `demo-reino` (ambos esquemas); checklist de teclado y lector con resultado.

## Fuera de Alcance

- Auditorías automatizadas externas (axe, Lighthouse) como requisito; pueden usarse a mano y anotarse.
- Daltonismo simulado de las paletas de parámetros (se recomienda; anotar en el reporte si se hizo).

## Verificación

- [ ] `pnpm universes:validate` pasa; bajar a propósito el contraste de `textPrimary` en el perfil del fixture hace fallar con `A_CONTRAST` (revertir).
- [ ] Un perfil con una fuente sin `fallback` falla con `A_FONT_MISSING` (test unitario de `validateAesthetic`).
- [ ] 360 px y 1280 px: sin scroll horizontal en las 4 páginas; objetivos táctiles ≥ 44 px.
- [ ] Con `prefers-reduced-motion` emulado: sin parpadeo ni desplazamientos; el cambio de tema por override es instantáneo.
- [ ] Recorrido completo solo con teclado; el foco visible y en el lugar correcto en cada cambio de fase.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Handoff

Produce: UI responsive y accesible, `validateAesthetic` enganchado al build, `a11y-report.md`. Task 08 verifica el recorrido completo.

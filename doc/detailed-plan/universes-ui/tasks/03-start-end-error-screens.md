# Task 03: Pantallas de inicio, final, error y carga

> Parte del plan: `../plan.md` — "Pantallas por página y fase" y "Decisiones de Diseño" #11.

## Skill / Capa

`add-ui-component` + `add-route` (composición en las páginas del plan del motor, task 12).

## Objetivo

Implementar `StartScreen`, `EndScreen`, `ErrorScreen` y `LoadingScreen` y cablearlas en `UniversePage`, `UniverseEndPage` y (`LoadingScreen`/`ErrorScreen`) `UniversePlayPage` y `UniversesIndexPage`.

## Depende De

- Task 02.
- Motor, task 11 (`NarrativeGame`, `EndView`, `startNewGame`, `hasSavedSession`, `notFound`, `retry`) y task 12 (páginas y `redirectFor`).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/components/{StartScreen,EndScreen,ErrorScreen,LoadingScreen}.tsx` — crear
- `apps/web/src/lab/universes/components/universes.css` — editar (secciones start/end)
- `apps/web/src/lab/universes/lib/copy.ts` — editar
- `apps/web/src/lab/universes/routes/UniversePage.tsx` — editar
- `apps/web/src/lab/universes/routes/UniverseEndPage.tsx` — editar
- `apps/web/src/lab/universes/routes/UniversePlayPage.tsx` — editar (solo los casos `loading`/`error`)
- `apps/web/src/lab/universes/routes/UniversesIndexPage.tsx` — editar (usa `LoadingScreen`)

## Detalles de Implementación

1. **`StartScreen`** `{ game: Pick<NarrativeGame, "title" | "description" | "phase" | "hasSavedSession">; onPlay; onContinue; onNew; onSeeEnd }`:
   - Eyebrow (`copy.eyebrow`), título (`display`, `title`), descripción (`body`), CTAs según fase (tabla "Pantallas por página y fase").
   - "Nueva partida" cuando hay partida guardada: **confirmación en dos pasos** (primer clic cambia el texto a "¿Seguro? Se pierde la partida actual", segundo confirma; `Escape` o foco fuera cancela). Reutilizar este patrón para "Abandonar" (task 05) con un pequeño hook `useTwoStepConfirm()` en `components/`.
2. **`EndScreen`** `{ end: EndView; onPlayAgain }`: resultado como etiqueta de texto + glifo ("VICTORIA", "DERROTA", "ABANDONADA" — no solo color), título y texto del final (`white-space: pre-line`), resumen (turnos, puntaje, etapa), insignias con `UniverseIcon` (task 04; hasta entonces solo nombre), parámetros finales en lista de texto, "Jugar de nuevo".
3. **`ErrorScreen`** `{ notFound: boolean; onRetry }`: mensaje claro, sin detalles técnicos; `notFound` ⇒ "Universo no encontrado" y enlace a `/lab/universes`; si no, botón "Reintentar".
4. **`LoadingScreen`**: texto "Cargando…" con `role="status"`; sin animación obligatoria.
5. **Foco**: cada pantalla tiene un `<h1 tabIndex={-1}>` y al montarse (o cambiar de fase) se enfoca (`useEffect` + `ref`); `EndScreen` al llegar. Hook común `useFocusOnMount(ref)`.
6. **Páginas**: `UniversePage` usa `useNarrativeGame(slug)` y renderiza según `phase`; navega con `useNavigate` (`startNewGame()` y luego `/lab/universes/:slug/jugar`); `UniverseEndPage` aplica `redirectFor` y renderiza `EndScreen`.

## Fuera de Alcance

- HUD, carta y opciones (Tasks 04–06); estilos finos y responsive (Task 07).

## Verificación

- [ ] `pnpm dev`: cada fase del inicio (sin partida / con partida / terminada) muestra la pantalla de la tabla; "Nueva partida" pide confirmación; un slug inexistente muestra "Universo no encontrado".
- [ ] Test de `StartScreen` (CTAs por fase y confirmación de dos pasos) y de `EndScreen` (etiqueta de resultado en texto).
- [ ] El foco queda en el `<h1>` de la pantalla al entrar.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`; sin hex.

## Handoff

Produce: las cuatro pantallas, `useTwoStepConfirm`, `useFocusOnMount`. Task 05 reutiliza la confirmación para "Abandonar".

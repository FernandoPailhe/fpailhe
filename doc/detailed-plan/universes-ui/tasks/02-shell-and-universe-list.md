# Task 02: Marco común — ThemeScope, layout, CSS base y lista de universos

> Parte del plan: `../plan.md` — "Decisiones de Diseño" #1, #2, #11, "Estructura de archivos", "Pantallas por página y fase" (Lista) y "Reglas de estilo".

## Skill / Capa

`add-ui-component` + `theming`. Presentación pura; sin lógica de juego.

## Objetivo

Construir el marco visual compartido por todas las páginas dentro de `UniversesLayout`: contenedor `.uv` tematizado con las variables del universo activo (o el tema de plataforma en la lista), cabecera, pie y `StatusPill`; y la pantalla de la lista de universos.

## Depende De

- Task 01 (tema).
- Plan `universes-engine`, task 12 (existen `UniversesLayout` stub y las páginas).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/components/ThemeScope.tsx` — crear
- `apps/web/src/lab/universes/components/StatusPill.tsx` — crear
- `apps/web/src/lab/universes/components/UniverseListItem.tsx` — crear
- `apps/web/src/lab/universes/components/universes.css` — crear
- `apps/web/src/lab/universes/components/UniversesLayout.tsx` — editar
- `apps/web/src/lab/universes/components/index.ts` — crear (barrel)
- `apps/web/src/lab/universes/lib/copy.ts` — crear
- `apps/web/src/lab/universes/routes/UniversesIndexPage.tsx` — editar
- `apps/web/src/lab/universes/components/statusForPath.ts` + `statusForPath.test.ts` — crear

## Detalles de Implementación

1. **`ThemeScope`** `{ theme: ThemeInput; locale?: string; children }`: calcula `composeTheme(theme, usePrefersDark())`, aplica `style={themeToCssVars(resolved)}` y `className="uv"` más `data-scheme`, `lang={locale}` y `data-card-transition` al contenedor. Nunca usa `document`/`window` directamente.
   - El layout obtiene el tema con `useUniverseTheme(slug)` (`slug` de `useParams()`; del plan del motor, task 11), de modo que cabecera y pie ya llevan la estética del universo; sin `slug` (la lista) se usa el tema de plataforma. Las páginas obtienen el mismo `theme` por `useNarrativeGame`, pero **no** crean otro `ThemeScope`.
2. **`universes.css`**: reglas **solo** bajo `.uv`, prefijo `uv-`; reset mínimo, fondo `var(--uv-color-background)`, color `var(--uv-color-textPrimary)`, `font-family: var(--uv-font-body)`, `min-height` de pantalla, `transition` de `background-color`, `color`, `border-color` con `var(--uv-motion-base)` y `var(--uv-easing)`. Clases base: `uv-shell` (ancho máx. 720 px centrado), `uv-header`, `uv-footer`, `uv-title`, `uv-eyebrow`, `uv-card-surface`, `uv-btn` / `uv-btn--primary` / `uv-btn--ghost`, `uv-sr-only`, `uv-pill`. Sin hex ni colores literales.
3. **`UniversesLayout`**: importa `universes.css`; `ThemeScope` + `<header>` (enlace "← Universos" a `/lab/universes` y nombre del universo cuando hay `slug`, `StatusPill` derivado de la ruta) + `<main id="main-content" tabIndex={-1}><Outlet/></main>` + `<footer>` con un texto corto de `copy.ts`. Incluye un enlace "Saltar al contenido".
4. **`statusForPath(pathname)`**: `"live"` en `/jugar`, `"ended"` en `/final`, `null` en el resto. **`StatusPill`** `{ status: "live" | "ended" }`: punto + texto ("EN CURSO" / "TERMINADA"); parpadeo del punto solo en `live` y anulado con reduced-motion.
5. **`UniverseListItem`** `{ title, description, to }`: tarjeta con título (`display`), descripción (`body`) y enlace "Entrar". **`UniversesIndexPage`**: `useUniverses()` ⇒ lista; cargando ⇒ `LoadingScreen` (task 03; hasta entonces texto "Cargando…"); vacío ⇒ "Todavía no hay universos publicados."; en DEV, los no publicados con la etiqueta "borrador".
6. **`copy.ts`**: constantes de texto de la UI en español (títulos, botones, etiquetas, mensajes de error); un objeto `copy` agrupado por pantalla.

## Fuera de Alcance

- Pantallas de inicio/final/error (Task 03), HUD (Task 04), carta (Task 05).
- Responsive fino y reduced-motion completo (Task 07); aquí solo lo necesario para que el marco no rompa a 360 px.

## Verificación

- [ ] `pnpm dev`: `/lab/universes` se ve con el tema de plataforma; `/lab/universes/demo-reino` toma los colores y fuentes del perfil de `demo-reino`.
- [ ] Test: `ThemeScope` aplica las variables (`getComputedStyle` o `style` del elemento) y `lang`; `statusForPath` tabla completa.
- [ ] Inspector: ningún color literal en `universes.css` (`grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(" apps/web/src/lab/universes/components/universes.css` vacío).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Handoff

Produce: `ThemeScope`, `UniversesLayout` tematizado, clases `uv-*` base, `copy.ts`, `StatusPill`, lista de universos. Los tasks 03 y 04 construyen sobre estos.

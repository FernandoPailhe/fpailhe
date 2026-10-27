# Task 12: Rutas `/lab/universes`, esqueleto jugable y shells de prerender

> Parte del plan: `../plan.md` — ver "Decisiones de Arquitectura" #5, #6, #7, "Pantallas / Rutas / Componentes", "Publicación de universos" y "Contrato para la UI".

## Skill / Capa

`add-route` (`.devin/skills/add-route/SKILL.md`). Rutas deep-linkables; layout propio. Sin browser APIs a nivel de módulo.

## Objetivo

Registrar las cuatro rutas del módulo con un esqueleto **funcional sin estilo** que ya permite jugar una partida completa usando `useNarrativeGame`, y hacer que el build emita un shell HTML por cada ruta de cada universo publicado (el hosting no tiene fallback SPA). El diseño real lo pone el plan `universes-ui`.

## Depende De

- Task 06 (`listUniverses`, para el script de shells no hace falta; sí para la lista) y Task 11 (`useNarrativeGame`, `useUniverses`).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/components/UniversesLayout.tsx` — crear (stub: `<main>` + `<Outlet/>`; **no** usa `AppLayout`)
- `apps/web/src/lab/universes/routes/UniversesIndexPage.tsx` — crear
- `apps/web/src/lab/universes/routes/UniversePage.tsx` — crear
- `apps/web/src/lab/universes/routes/UniversePlayPage.tsx` — crear
- `apps/web/src/lab/universes/routes/UniverseEndPage.tsx` — crear
- `apps/web/src/lab/universes/routes/universesRouting.ts` + `universesRouting.test.ts` — crear
- `apps/web/src/lab/universes/lib/seo.ts` — crear (título/descripción por página)
- `apps/web/src/lab/universes/index.ts` — crear (barrel público del módulo)
- `apps/web/src/App.tsx` — editar
- `apps/web/scripts/universeShells.mjs` — crear
- `apps/web/scripts/prerender.mjs` — editar (mínimo)

## Detalles de Implementación

1. **Rutas** (React Router 6, en `App.tsx`, **antes** del catch-all `*`; el resto de rutas queda intacto). Importar solo del barrel del módulo:
   ```tsx
   // index.ts del módulo
   import { lazy } from "react";
   export const UniversesLayout = lazy(() => import("./components/UniversesLayout").then(m => ({ default: m.UniversesLayout })));
   // idem UniversesIndexPage, UniversePage, UniversePlayPage, UniverseEndPage (named exports en sus archivos; el .then adapta a lazy)
   ```
   En `App.tsx`: `<Route path="lab/universes" element={<Suspense fallback={…}><UniversesLayout/></Suspense>}>` con hijos `index`, `:slug`, `:slug/jugar`, `:slug/final`, cada uno envuelto en `Suspense` con un fallback de texto "Cargando…" (los `default` internos de `lazy` son el único uso tolerado de `default`: no se declaran `export default` en ningún archivo).
2. **`universesRouting.ts`**: `redirectFor(slug: string, page: "home" | "play" | "end", phase: NarrativePhase): string | null` — `play` + `no_session` ⇒ `/lab/universes/:slug`; `play` + `ended` ⇒ `/lab/universes/:slug/final`; `end` + `no_session` ⇒ `/lab/universes/:slug`; `end` + (`card`/`between`) ⇒ `/lab/universes/:slug/jugar`; resto ⇒ `null`. Tabla probada en el test.
3. **`UniversesIndexPage`** (`useUniverses()`): lista los universos (título, descripción, enlace a `/lab/universes/:slug`); vacío ⇒ "Todavía no hay universos publicados."; en DEV marcar los no publicados con "(borrador)".
4. **`UniversePage`** (`useNarrativeGame(slug)`): `notFound` ⇒ mensaje "Universo no encontrado" con enlace a `/lab/universes`; muestra `title` y `description`; si `hasSavedSession` ⇒ botón "Continuar" (navega a `…/jugar`) y "Nueva partida" (`startNewGame()` y navega); si no ⇒ "Jugar"; `phase: "ended"` ⇒ enlace "Ver final" + "Nueva partida"; `loading`/`error` con texto plano y botón "Reintentar" (`retry()`).
5. **`UniversePlayPage`** (`useNarrativeGame(slug, { autoStartTurn: true })`): según `phase`: `card` ⇒ lista de parámetros (texto + `<progress>`), poderes, texto de carta y un `<button>` por opción (las `locked` con `lockedReason`, `aria-disabled`); `outcome` ⇒ `chosenLabel`, `outcomeText`, eventos y botón "Continuar" (`next()`; "Ver final" si `outcome.ended`); aplica `redirectFor` con `<Navigate replace/>`. Botón "Abandonar" (`abandon()`).
6. **`UniverseEndPage`** (`useNarrativeGame(slug)`): muestra `end` (título, texto, turnos, puntaje, etapa, insignias) y "Jugar de nuevo" (`startNewGame()` + navegar); aplica `redirectFor`.
7. **SEO**: `lib/seo.ts` exporta `titleFor(page, gameTitle?)` y un hook mínimo `useDocumentTitle(title)` (`useEffect` que setea `document.title`, sin browser APIs a nivel de módulo). Formato: `"<Universo> — Universos — Fernando Pailhe"`; `/jugar` y `/final` no se indexan (agregar `<meta name="robots" content="noindex">` desde el mismo hook, y quitarlo al desmontar). No agregar librerías.
8. **Shells de prerender** — `apps/web/scripts/universeShells.mjs`:
   - `export function buildUniverseShells(): { route: string; title: string; html: string }[]`.
   - Lee `apps/web/src/lab/universes/content/*/game.json` (Node `fs`; **sin** fixtures), conserva los de `status === "published"` y arma, con el **mismo formato** que el shell de `/lab/trymate` en `prerender.mjs` (mismas clases Tailwind): `/lab/universes` (lista de universos publicados con enlaces), y por cada universo `/lab/universes/<slug>`, `/lab/universes/<slug>/jugar` y `/lab/universes/<slug>/final` (título + descripción + "requiere JavaScript" + enlace de vuelta).
   - Escapar todo texto con una función local `escapeHtml` (no importar de `prerender.mjs`). Si no hay universos publicados, devolver solo el shell de `/lab/universes` (con "Todavía no hay universos publicados").
   - En `prerender.mjs`: importar `buildUniverseShells` y cambiar la constante a `const SHELL_ROUTES = [ …el shell actual de trymate…, ...buildUniverseShells() ]`. No tocar nada más del archivo.
9. **Sin enlace** desde la home, el CV ni el nav.

## Fuera de Alcance

- Diseño visual, tokens, CSS (plan `universes-ui`).
- Sitemap, Open Graph por universo.
- Firebase, auth.

## Verificación

- [ ] `pnpm dev`: `/lab/universes` lista `Reino de pruebas`; se juega una partida completa hasta victoria y hasta derrota usando solo estas páginas; recargar en `…/jugar` restaura la partida; `…/final` sin partida redirige a `/lab/universes/demo-reino`; un slug inexistente muestra "Universo no encontrado".
- [ ] `redirectFor` probado (tabla completa).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- [ ] `pnpm build` termina y `ls apps/web/dist/lab/universes` contiene `index.html`; el log de prerender sigue mostrando los shells existentes. (Con `content/` vacío solo existe `lab/universes/index.html`; el fixture no se prerenderiza.)
- [ ] Prueba del script con un universo publicado de prueba: copiar temporalmente `testing/fixtures/demo-reino` a `content/demo-reino`, correr `pnpm build`, comprobar `dist/lab/universes/demo-reino/{index,jugar/index,final/index}.html`; **borrar la copia** (mover a una carpeta fuera del repo o `git checkout`/`git clean` solo de esa ruta) antes de commitear.
- [ ] `/`, `/cv`, `/projects/:id`, `/lab/trymate` y el catch-all (`*`) siguen funcionando como antes.

## Handoff

Produce: rutas operativas y jugables en texto plano, `redirectFor`, `useDocumentTitle`, shells de prerender. El plan `universes-ui` reemplaza el interior de las páginas y del layout conservando rutas y hook.

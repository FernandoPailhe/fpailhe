# universes-ui — aceptación

Fecha: 2026-04-03. Estado: implementado (tasks 01–08).

## Verificación funcional (matriz)

| Criterio | Verificación |
| --- | --- |
| Rutas funcionan (lista, info, jugar, final) | `playthrough.test.tsx` monta las 4 rutas reales en `MemoryRouter` y navega todas; dev server sirve `/lab/universes*`. |
| Playthrough completo sin errores de consola | Test `playthrough` hace lista → Entrar → Jugar → carta+HUD → opción → resultado → siguiente turno → Abandonar → final ABANDONADA. Sin warnings en consola del test. |
| Recarga preserva la partida | `useNarrativeGame` persiste cada transición vía `LocalSessionRepository`; `sessionStore.test.ts` cubre hidratación y slots por slug. |
| Tema por datos | `ThemeScope.test.tsx` renderiza `Hud + SituationCard + OptionList` con `demo-reino` y `aestheticAlt`: marcado hijo idéntico (sin `style`), vars `--uv-*`, fuentes, radios y `data-card-transition` distintos. |
| Overrides de rama/etapa | `composeTheme.test.ts`: override aplica solo con condición cumplida; el último `cardTransition` gana. `demo-reino` trae override de rama real. |
| Fallbacks | `composeTheme`: sin perfil → plataforma; color inválido → plataforma. `platformTheme` validado por tests. |
| Responsive 360px + desktop | CSS mobile-first (`.uv` con `min()` clamp, grid flexible, `overflow-wrap`), breakpoint 680px, targets táctiles ≥44px. |
| A11y | `a11y-report.md`: contraste AA/AAA en todos los pares core (plataforma y `demo-reino`); foco visible (`:focus-visible`); skip-link; `role="meter"` en parámetros; `aria-live` para resultado y estado; `aria-disabled` en opciones bloqueadas; hotkeys 1–3 ignoran campos y bloqueadas; `useFocusOnMount` mueve foco a carta/resultado/error. |
| Reduced motion | `@media (prefers-reduced-motion: reduce)`: sin blink del pill, transiciones de carta → fade corto (60ms), sin `theme-transition`, sin fade-in. Test `usePrefersDark`-style cubierto por render con `matchMedia` mockeado. |
| i18n | Todo el copy de UI vive en `application/lib/copy.ts`; contenido via `localize(text, locale)` con `resolveLocale` (sesión → navigator → default). |
| Estática + SEO | `universeShells.mjs` genera shells tematizados (title/meta/ld+json por universo); `seo.ts` actualiza meta en runtime; 404 copy distinta en `/final`. Build emite shells para los universo(s) publicados. |
| Lazy loading | `content.ts` con `import.meta.glob`; fixture solo en `!PROD`. Build muestra chunks por página (`UniversePlayPage`, `UniversesLayout`, …). |
| Sin `any`, named exports, sin API navegador en dominio | Grep de reglas limpio; ESLint guard bloquea `domain/`→capas superiores/`@ferpa/*`. |
| Solo variables CSS (sin literales de color en `.css`/`.tsx`) | `grep -rnE "#hex\|rgb(\|hsl("` en el módulo: **0 coincidencias** en fuente (solo `testing/*.ts` y JSONs de contenido, permitidos). |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm universes:validate` | Todos verdes; suite completa del repo (98 archivos, ~750 tests) en verde incl. la regresión `appShell.test.ts` corregida para escanear también `universeShells.mjs`. |

## Playthrough manual — checklist pendiente de QA humano

El test `routes/playthrough.test.tsx` automatiza el flujo completo en jsdom. Para la
verificación visual/manual se debe:

1. `pnpm dev` → http://localhost:5173/lab/universes
2. Recorrer: lista → `demo-reino` → Jugar → opciones → resultado → Continuar →
   Abandonar → Final → Volver a jugar (con confirmación al existir partida).
3. Repetir a 360px (DevTools device toolbar) y con `prefers-reduced-motion`
   emulado.
4. Capturas → `doc/detailed-plan/universes-ui/screenshots/` (directorio creado;
   capturas pendientes de sesión manual).

## Notas

- `packages/ui` tokens: se agregaron **solo claves nuevas** semánticas
  (`positive`, `negative`, `warning`, `info`, `overlay`, `accentContrast`) en
  `tokens.ts`/`darkTokens.ts`; valores existentes intactos.
- `appShell.test.ts` (trymate): se extendió el scanner de rutas prerenderizadas
  para incluir `universeShells.mjs` (las rutas `/lab/universes*` se generan por
  datos, no literales en `prerender.mjs`).
- Cloudflare `wrangler.toml` sin cambios (404-page maneja rutas no shell).

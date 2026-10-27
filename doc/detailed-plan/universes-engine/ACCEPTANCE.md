# Aceptación — universes-engine

Verificación final del plan `universes-engine` (tasks 01–13). Cada criterio con ✔/✘ y evidencia.

## 1. Calidad automática

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | ✔ limpio (packages + apps/web, strict + `noUncheckedIndexedAccess`) |
| `pnpm lint` | ✔ 0 errores; 1 warning preexistente en `packages/ui/src/atoms/Button.tsx` |
| `pnpm test` | ✔ 115 archivos, 810 tests + 14 skipped (los arena de TryMate tardan ~9 min) |
| `pnpm universes:validate` | ✔ 28 tests; valida todos los bundles de `content/` + fixtures |
| `pnpm build` | ✔ corre `universes:validate` primero, luego compila y emite shells |

## 2. Criterios globales del plan

- ✔ `domain/models.ts` es copia verbatim del spec: `diff doc/specs/lab/universes/narrative-game-models.ts apps/web/src/lab/universes/domain/models.ts` solo muestra las 3 líneas de comentario de procedencia. Tipos definidos una sola vez; `rg "@ferpa/data-model" src/lab/universes` vacío (salvo README).
- ✔ Motor puro: `rg 'from "(react|react-dom|zustand|@tanstack|react-router-dom)"' domain/` vacío; `rg 'Math\.random|Date\.now|crypto' domain/engine` (sin tests ni `testing.ts`) vacío — azar/reloj solo por `EngineContext` (`application/engineContext.ts`).
- ✔ `pnpm universes:validate` falla ante violaciones de integridad de un `published` (probado: `characterId` roto ⇒ `E_REF_MISSING @ cards[off_card_015_estratega].characterId`) y está enganchado a `build` raíz.
- ✔ Partida completa sin red: todo el contenido viaja embebido en chunks perezosos del bundle (`import.meta.glob`); las únicas lecturas de estado son `localStorage`. No hay `fetch` ni dependencia de red en el módulo.
- ✔ Deep links: `dist/lab/universes/index.html` existe; con un universo `published` (prueba con copia temporal del fixture, revertida) se emiten `…/<slug>/index.html`, `…/jugar/index.html` y `…/final/index.html` y `vite preview` los sirve con 200.
- ✔ Recargar en `…/jugar` restaura la partida: `SessionRepository` sobre `localStorage` guarda tras cada transición y `useNarrativeGame` hidrata el store una vez (tests de `localSessions` + `sessionStore`).
- ✔ Rama X no aparece fuera de rama; `once` no reaparece; `repeatable` respeta cooldown/máximo; `balance` solo con su condición (tests de `selection`/`options` + cobertura del fixture en `content.test.ts`).
- ✔ Threshold + shield: con shield consume carga, emite `shield_used` y reposiciona; sin shield dispara (tests de `thresholds`/`effects`).
- ✔ Parámetros nuevos se activan por etapa y cambia `difficultyRange` (fixture: 2 → 4 parámetros en 3 etapas; tests de `stages` + cobertura).
- ✔ Texto sin traducción cae a `default`; `resolveLocale` prioriza `supportedLocales` y luego idioma base (tests de `localize`).
- ✔ Simulación: 200 semillas × 3 políticas en `demo-reino` terminan sin atascarse (tope 500 turnos), misma semilla ⇒ misma secuencia de cartas; se alcanzan victoria (~20–23% según política) y derrota.

## 3. Reglas del repo

- ✔ Sin dependencias nuevas: `git diff` de `package.json`/`pnpm-lock.yaml` solo agrega el script `universes:validate` y modifica `build`.
- ✔ Sin `any`, sin `export default` (el adaptador `lazy(...).then(m => ({default: m.X}))` del barrel es el único uso tolerado); exports con nombre en todo el módulo.
- ✔ Zustand solo en `application/store/sessionStore.ts`.
- ✔ Solo `App.tsx` importa el módulo y únicamente desde el barrel `index.ts`.
- ✔ Browser APIs: `storage.ts` y `identity.ts` guardan `typeof window` dentro de funciones; `navigator` solo dentro de `navigatorLanguages()` con `typeof`; `document` solo dentro del `useEffect` de `useDocumentTitle`.
- ✔ Corrección aplicada durante la verificación: `evaluateCondition` devolvía el objeto (truthy) en el `default` del switch exhaustivo — ahora devuelve `false` (condiciones inválidas no habilitan contenido).

## 4. Regresión

- ✔ `git diff --stat` toca solo: `apps/web/src/App.tsx` (rutas nuevas antes del `*`), `eslint.config.js` (guards del módulo), `package.json` raíz (scripts), `apps/web/scripts/prerender.mjs` (import + spread en `SHELL_ROUTES`), `apps/web/scripts/universeShells.mjs` (nuevo), `.devin/rules/project-map.md`, `.devin/skills/design-universe-entities/references/entity-templates.md` (`status: draft` + `metadata.endings`), `doc/universes/README.md` (publicación), más todos los archivos nuevos de `apps/web/src/lab/universes/` y `apps/web/public/universes/demo-card.svg`.
- ✔ El prerender de `/`, `/cv` y `/projects/*` no cambió: el diff de `prerender.mjs` solo agrega el import y `...buildUniverseShells()`; el log muestra las mismas páginas ("Prerendered /, /cv and 1 project page(s)").
- ✔ `/`, `/cv`, `/projects/:id`, `/lab/trymate` y el catch-all `*` siguen intactos en `App.tsx`.

## 5. Tamaños / chunks

- El módulo no entra al bundle inicial: rutas y hook salen como chunks perezosos (`UniversesLayout` 0.15 kB, `universesRouting` 0.25 kB, `UniversesIndexPage` 0.84 kB, `UniverseEndPage` 1.29 kB, `UniversePage` 1.40 kB, `seo` 1.93 kB, `UniversePlayPage` 2.49 kB, `useNarrativeGame` 29.91 kB).
- `rg "demo-reino|demo_reino" apps/web/dist` vacío: el fixture no entra a producción (`import.meta.env.DEV`/`MODE` resueltos en build).

## 6. Hosting

- `wrangler.toml` raíz mantiene `not_found_handling = "404-page"` (sin fallback SPA): por eso existen los shells por ruta. En `vite preview` una ruta inexistente devuelve el `index.html` genérico (la app muestra "Universo no encontrado"); en Cloudflare una ruta sin shell da la 404-page.

## 7. Documentación

- ✔ `project-map.md` describe el módulo implementado (capas, contenido, publicación) sin la marca de "en construcción".
- ✔ `doc/universes/README.md` documenta cómo publicar (`status: "published"` + `pnpm universes:validate`); `entity-templates.md` genera `game.json` en `draft` con `metadata.endings`.

## 8. Preguntas abiertas / riesgos aceptados

- El contenido en `draft` se empaqueta en chunks aunque no se enlace (riesgo aceptado del plan; si debe ser secreto hay que sacarlo del repo).
- Constantes del motor (`SHIELD_RECOVERY_RATIO`, `THRESHOLD_RISK_RATIO`, etc.) sin calibrar: esperan universo real.
- Sin estadísticas de cartas (`getCardCounters` ⇒ `[]`), sin feedback real (`FeedbackRepository` no-op), sin persistencia remota: el plan `universes-community` las reemplaza por la rama Firebase dentro de `getUniverseRepositories()`.
- La política "última opción" pierde siempre en `demo-reino` (balance razonable para un fixture, no objetivo de tuning).

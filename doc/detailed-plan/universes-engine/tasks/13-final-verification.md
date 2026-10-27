# Task 13: Verificación final del motor y las rutas

> Parte del plan: `../plan.md` — "Criterios de Aceptación Globales", "Fuera de Alcance Global" y "Preguntas Abiertas / Supuestos".

## Skill / Capa

QA. Sin código nuevo salvo correcciones puntuales de lo que falle. Usar el checklist pre-commit de `.devin/rules/rules.md` (§10).

## Objetivo

Comprobar que se cumplen los criterios globales, que no se rompió nada existente y que el contrato queda listo para el plan `universes-ui`.

## Depende De

- Tasks 01–12.

## Archivos a Crear/Editar

- `doc/detailed-plan/universes-engine/ACCEPTANCE.md` — crear (cada criterio con ✔/✘ y evidencia breve)
- Correcciones puntuales (anotadas en el mismo documento)

## Detalles de Implementación

1. **Calidad automática** desde la raíz: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm universes:validate`, `pnpm build`. Todo en verde.
2. **Criterios globales**: recorrer la lista de "Criterios de Aceptación Globales" del plan, uno por uno, con evidencia. Comprobaciones específicas:
   - Una partida completa sin red tras cargar la app (modo avión) en `pnpm preview`, con el fixture copiado a `content/` (ver task 12; revertir después).
   - `/lab/universes/<slug>`, `/jugar` y `/final` cargan directo y recargados **en `pnpm preview`** (que sirve `dist/` real): los tres devuelven 200 gracias a los shells.
   - Idioma del navegador `en` ⇒ textos con traducción en inglés; idioma no soportado ⇒ `es`.
   - Simulaciones del task 08 pasan (victoria y derrota alcanzables en `demo-reino`, determinismo por semilla).
3. **Reglas del repo** (revisión de código):
   - `grep -rn "@ferpa/data-model" apps/web/src/lab/universes` vacío; `grep -rnE "from \"(react|react-dom|zustand|@tanstack|react-router-dom)" apps/web/src/lab/universes/domain` vacío.
   - `grep -rnE "window\.|localStorage|navigator\.|document\." apps/web/src/lab/universes/{domain,application,infrastructure}` ⇒ cada hallazgo está dentro de una función o protegido por `typeof window`.
   - `grep -rnE "Math\.random|Date\.now|crypto" apps/web/src/lab/universes/domain/engine` (excluyendo tests y `testing.ts`) vacío.
   - Zustand solo en `application/store/sessionStore.ts` dentro del módulo.
   - `git diff package.json apps/web/package.json pnpm-lock.yaml`: **sin dependencias nuevas**.
   - Sin `any`, sin `export default` (salvo el adaptador `.then(m => ({ default: ... }))` de `lazy`), nombres exportados con nombre.
   - Imports desde fuera del módulo: solo `App.tsx` importa de `./lab/universes` y solo del barrel `index.ts`.
4. **Regresión**: `git diff --stat` solo incluye los archivos listados en los tasks (`App.tsx`, `eslint.config.js`, `package.json` raíz, `prerender.mjs`, docs y skills de `.devin`); el prerender de `/`, `/cv` y `/projects/*` genera lo mismo que antes (comparar `dist/` de `main` contra el actual con `diff -r` en esas rutas).
5. **Tamaños**: listar los chunks de `apps/web/dist/assets`; el chunk de universes no está en el bundle inicial; `grep -rl "demo-reino" apps/web/dist` vacío (el fixture **no** entra a producción); anotar el tamaño del chunk de rutas.
6. **Hosting**: confirmar que `wrangler.toml` sigue con `not_found_handling = "404-page"` y que un slug no publicado da 404 en `pnpm preview`; anotar.
7. **Consistencia de documentación**: `diff doc/specs/lab/universes/narrative-game-models.ts apps/web/src/lab/universes/domain/models.ts` solo difiere en el comentario inicial; `doc/universes/README.md` y `.devin/rules/project-map.md` apuntan a este plan y a `universes-ui`, y la sección del módulo en `project-map.md` pasa a "implementado".
8. **Seguimiento**: en `ACCEPTANCE.md`, listar las "Preguntas Abiertas" del plan sin resolver y los riesgos aceptados (contenido en borrador en chunks, constantes del motor sin calibrar, sin estadísticas ni feedback).

## Fuera de Alcance

- Optimización más allá de comprobar el chunking.
- Funcionalidades nuevas.

## Verificación

- [ ] Todos los comandos del punto 1 pasan desde un clon limpio.
- [ ] `ACCEPTANCE.md` completo, sin ítems en blanco.
- [ ] El PR enumera cualquier criterio no cumplido con su motivo.

## Handoff

Produce: motor, contenido, estado y rutas aceptados. `universes-ui` puede ejecutarse (o ya se ejecutó) sobre `useNarrativeGame` y las rutas `/lab/universes*`.

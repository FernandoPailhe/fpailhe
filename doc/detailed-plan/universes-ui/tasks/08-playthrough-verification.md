# Task 08: Verificación de una partida completa

> Parte del plan: `../plan.md` — "Criterios de Aceptación" y "Fuera de Alcance".

## Skill / Capa

QA. Sin funcionalidades nuevas; solo correcciones de lo que falle. Usar el checklist pre-commit de `.devin/rules/rules.md` (§10).

## Objetivo

Confirmar que la UI permite jugar de punta a punta en escritorio y móvil, que la estética realmente se define por datos y que no se rompió nada existente.

## Depende De

- Tasks 01–07.

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/testing/aestheticAlt.ts` — crear (un `AestheticProfile` alternativo, **solo para tests**: colores, fuentes, radios y `cardTransition` distintos a los de `demo-reino`)
- `apps/web/src/lab/universes/components/ThemeScope.test.tsx` — crear
- `doc/detailed-plan/universes-ui/ACCEPTANCE.md` — crear (checklist con evidencia)
- `doc/detailed-plan/universes-ui/screenshots/` — crear (capturas)
- Correcciones puntuales (anotadas en `ACCEPTANCE.md`)

## Detalles de Implementación

1. **Automático** (raíz): `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm universes:validate`, `pnpm build`. Todo en verde.
2. **Test de tematización** (`ThemeScope.test.tsx`): renderizar los mismos componentes (`Hud` + `SituationCard` + `OptionList`) con el perfil de `demo-reino` y con `aestheticAlt`; las variables CSS del contenedor difieren (colores, `--uv-font-*`, `--uv-radius-*`, `data-card-transition`) y **el marcado de los componentes es idéntico** (comparar el HTML sin el atributo `style`). Es la prueba del criterio "cambiar de estética sin tocar componentes".
3. **Recorrido manual** con `pnpm dev` y el universo `demo-reino`:
   - Escritorio (1280 px) y móvil (360 px, emulado): lista → inicio → jugar hasta **victoria** y hasta **derrota** (usar la simulación del motor para encontrar una secuencia de elecciones si hace falta) → final → "Jugar de nuevo".
   - Solo teclado en un recorrido completo.
   - Reload en `/jugar` restaura la partida; "Continuar" en el inicio; "Nueva partida" con confirmación; "Abandonar" ⇒ final "abandonada".
   - Opción bloqueada con razón; eventos y `delta`; cambio de etapa activa un parámetro nuevo.
   - **Override por rama**: entrar a la rama que activa el `ThemeOverride` cambia el acento con transición; salir revierte (con reduced-motion, sin transición).
   - Degradación: temporalmente quitar un `svg` de un ícono, poner un color inválido en el perfil y borrar `aesthetic.json` (en una copia): la UI usa los fallbacks sin errores en consola.
   - Capturas (escritorio y móvil) de inicio, carta, resultado y final en `screenshots/`.
4. **Regresión**: `/`, `/cv`, `/projects/:id` y `/lab/trymate` se ven y funcionan igual; `git diff --stat` solo incluye archivos del módulo, `App.tsx`, `eslint.config.js`, `prerender.mjs`, `universeShells.mjs`, `package.json` raíz, docs y (si fue imprescindible) **adiciones** a `packages/ui/src/theme/tokens.ts`.
5. **Reglas del repo**: `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(" apps/web/src/lab/universes --include=*.css --include=*.tsx` vacío (los hex de `testing/` y de los JSON de contenido son datos, permitidos); `@ferpa/ui` no importa nada del módulo; named exports; sin `any`.
6. **Seguimiento**: en `ACCEPTANCE.md`, anotar preguntas abiertas sin resolver (carga de fuentes, textos de la UI en un solo idioma) y qué queda para `universes-community`.

## Fuera de Alcance

- Funcionalidades nuevas, optimización más allá de comprobar tamaños.

## Verificación

- [ ] Todos los criterios de "Criterios de Aceptación" del plan con ✔ y evidencia en `ACCEPTANCE.md`.
- [ ] El PR enumera cualquier criterio no cumplido con su motivo.

## Handoff

Produce: UX/UI v1 aceptada. La plataforma queda lista para sumar universos reales en `content/` sin tocar código y para el plan `universes-community`.

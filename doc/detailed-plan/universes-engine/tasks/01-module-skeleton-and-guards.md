# Task 01: Esqueleto del módulo, tipos del modelo, constantes y guards

> Parte del plan: `../plan.md` — ver "Decisiones de Arquitectura" #1–#3, #9, "Entidades" y "Estructura de archivos".

## Skill / Capa

Tooling + `add-feature` paso 1 (tipos de dominio). Reglas: `.devin/rules/rules.md` (§1 paquetes, §8 TypeScript estricto, §9 dependencias, §12 convenciones).

## Objetivo

Crear la carpeta `apps/web/src/lab/universes/` con el modelo de datos copiado, las constantes y los tipos/config del motor, el guard de ESLint que mantiene el módulo autónomo, y alinear la plantilla de los skills (`status: "draft"` + finales). Al terminar, `pnpm typecheck`, `pnpm lint` y `pnpm test` siguen en verde.

## Depende De

Nada.

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/domain/models.ts` — crear (copia verbatim de `doc/specs/lab/universes/narrative-game-models.ts` + comentario inicial)
- `apps/web/src/lab/universes/domain/constants.ts` — crear
- `apps/web/src/lab/universes/domain/extensions.ts` — crear (ver `../plan.md#tipos-nuevos`)
- `apps/web/src/lab/universes/domain/repositories.ts` — crear (puertos, solo tipos)
- `apps/web/src/lab/universes/domain/engine/config.ts` — crear
- `apps/web/src/lab/universes/domain/engine/types.ts` — crear
- `apps/web/src/lab/universes/domain/engine/index.ts` — crear (barrel vacío por ahora: `export * from "./config"; export type * from "./types";`)
- `apps/web/src/lab/universes/domain/index.ts` — crear (barrel: `export * from "./models"; export * from "./constants"; export * from "./extensions"; export type * from "./repositories"; export * from "./engine";`)
- `apps/web/src/lab/universes/content/.gitkeep` — crear
- `apps/web/src/lab/universes/README.md` — crear
- `eslint.config.js` — editar (guard)
- `.devin/skills/design-universe-entities/references/entity-templates.md` — editar (plantilla de `game.json`)
- `doc/universes/README.md` — editar (sección "Publicar")
- `.devin/rules/project-map.md` — editar (la fila del módulo pasa de "planificado" a "en construcción" con enlace a este plan)

## Detalles de Implementación

1. **`models.ts`**: `cp doc/specs/lab/universes/narrative-game-models.ts apps/web/src/lab/universes/domain/models.ts` y anteponer
   ```ts
   // Copia de doc/specs/lab/universes/narrative-game-models.ts (fuente de verdad).
   // Si el spec cambia, copiar de nuevo; NO editar este archivo a mano.
   // Verificación: `diff` contra el spec solo debe diferir en estas 3 líneas.
   ```
   Debe compilar con `strict` + `noUncheckedIndexedAccess` (`tsconfig.base.json`). Si no compila, **no editar el modelo**: anotar el error en el task y avisar.
2. **`constants.ts`**: `NARRATIVES_SCHEMA_VERSION = 1`, `OFFICIAL_ID_PREFIX = "off_"`, `USER_ID_PREFIX = "usr_"`, `ID_PATTERN = /^[A-Za-z0-9_-]+$/` (`as const` donde aplique).
3. **`repositories.ts`**: los puertos `GameContentRepository`, `CardRepository`, `FeedbackRepository` y `SessionRepository` tal cual el bloque "Puertos de repositorio" de `../plan.md#contrato-del-motor` (solo tipos; se omite `UserCardRepository`). Exportarlos desde `domain/index.ts`.
3b. **`engine/config.ts`**:
   ```ts
   export const ENGINE_CONFIG = {
     MAX_CASCADE_DEPTH: 10,
     SHIELD_RECOVERY_RATIO: 0.1,
     THRESHOLD_RISK_RATIO: 0.15,
     MIN_IMPRESSIONS_FOR_WEIGHT: 20,
     FEEDBACK_FACTOR_MIN: 0.2,
     FEEDBACK_FACTOR_MAX: 2.0,
     NEEDS_REVIEW_MIN_VOTES: 10,
     NEEDS_REVIEW_NEGATIVE_RATIO: 0.6,
   } as const;
   ```
4. **`engine/types.ts`**: copiar **tal cual** los tipos del bloque `types.ts` de `../plan.md#contrato-del-motor` (`GameContent`, `EngineContext`, `CardStatsMap`, `RelaxationLevel`, `GameEvent`, `OptionState`, `BeginTurnResult`, `ResolveInput`, `ResolveResult`, `ValidationIssue`) más `RawGameBundle` y `RawCardCounters` (están en el bloque de firmas). Importar los tipos del modelo desde `"../models"`.
5. **Guard de ESLint** (`eslint.config.js`, agregar bloques nuevos siguiendo el estilo del bloque de trymate):
   - `files: ["apps/web/src/lab/universes/domain/**/*.ts"]` (ignorar `**/*.test.ts` y `engine/testing.ts` solo para el segundo punto): `no-restricted-imports` con patrones `react`, `react-dom`, `react-router-dom`, `zustand`, `@tanstack/*`, `firebase`, `firebase/*`, `@ferpa/*`, `**/application/**`, `**/infrastructure/**`, `**/components/**`, `**/routes/**` y el mensaje "domain es puro: no importa React, la app ni otras capas".
   - `files: ["apps/web/src/lab/universes/domain/engine/**/*.ts"]` (ignorar tests y `testing.ts`): `no-restricted-properties` que prohíba `Math.random`, `Date.now`, y `no-restricted-globals` para `window`, `document`, `localStorage`, `navigator`, `crypto`; mensaje "El motor es puro: azar/reloj/ids entran por EngineContext".
   - `files: ["apps/web/src/lab/universes/**/*.{ts,tsx}"]`: `no-restricted-imports` que prohíba `@ferpa/data-model` (el módulo es autónomo; ver decisión #1).
6. **README del módulo** (`README.md`, ≤ 40 líneas): qué es, las capas, cómo extraerlo a otro repo (copiar la carpeta, `apps/web/scripts/universeShells.mjs`, el bloque de ESLint y el script `universes:validate`; dependencias: `react`, `react-router-dom`, `zustand`, `@tanstack/react-query`) y el puntero a `doc/universes/README.md`.
7. **Plantilla de skills** (`entity-templates.md`, sección `## game.json`): cambiar `"status": "published"` por `"status": "draft"`, y agregar dentro del objeto un campo `"metadata": { "endings": { "<endingKey>": { "title": { "default": "" }, "text": { "default": "" } } } }` con una nota debajo: "Todo `endingKey` usado en `end_game` (y `no_cards`) debe tener entrada en `metadata.endings`; publicar = cambiar `status` a `published` a mano". No tocar otra cosa de los skills.
8. **`doc/universes/README.md`**: en la sección "Estado de la plataforma" reemplazar el bullet "No hay todavía…" por una referencia a `doc/detailed-plan/universes-engine/plan.md` y `universes-ui/plan.md` (plan escrito, implementación pendiente) y agregar una sección corta "Publicar un universo": cambiar `Game.status` a `published`, correr `pnpm universes:validate`.

## Fuera de Alcance

- Implementar cualquier función del motor (tasks 02–05).
- Rutas, componentes, `App.tsx`.
- Modificar `packages/*` o los tokens.

## Verificación

- [ ] `diff doc/specs/lab/universes/narrative-game-models.ts apps/web/src/lab/universes/domain/models.ts` muestra solo las 3 líneas de comentario.
- [ ] `pnpm typecheck`
- [ ] `pnpm lint` (sin errores nuevos). Prueba negativa temporal: agregar `import "react"` en `domain/engine/config.ts` ⇒ lint falla; quitarlo.
- [ ] `pnpm test` (el proyecto `web` sigue pasando; aún no hay tests nuevos).
- [ ] En `entity-templates.md`, la sección `## game.json` muestra `"status": "draft"` y el bloque `metadata.endings`; las demás entidades siguen igual.

## Handoff

Produce: `domain/models.ts`, `constants.ts`, `extensions.ts` (`endingFor`), `engine/config.ts` (`ENGINE_CONFIG`), `engine/types.ts`, barrels, guards de ESLint y README del módulo. Los tasks 02–05 agregan funciones al motor; el 05 (validación) y el 06 usan `RawGameBundle`.

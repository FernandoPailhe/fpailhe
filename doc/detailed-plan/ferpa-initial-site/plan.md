# Plan: Ferpa Initial Site (fpailhe.dev)

## Objetivo

Implementar el sitio personal de Fernando Pailhe como una app web estática de dos rutas — Home (`/`) y CV (`/cv`) — consumiendo los datos poblados de `content-data.md` y respetando el sistema de diseño y arquitectura de capas del monorepo Ferpa.

## Fuente de Requerimientos

- `docs/specs/init/design-specs.md` — tokens, data model, flujo web/print, component patterns.
- `docs/specs/init/content-data.md` — valores concretos de cada entidad.

## Entidades

Todas las interfaces viven en `packages/data-model/src/types.ts`.

### `Profile`

| Campo        | Tipo     | Notas                                            |
| ------------ | -------- | ------------------------------------------------ |
| `name`       | `string` | Nombre completo.                                 |
| `role`       | `string` | Título profesional.                              |
| `location`   | `string` | Ubicación.                                       |
| `remoteNote` | `string` | Nota de disponibilidad remota.                   |
| `domain`     | `string` | Dominio del sitio.                               |
| `email`      | `string` | Email de contacto.                               |
| `linkedin`   | `string` | URL LinkedIn.                                    |
| `github`     | `string` | URL GitHub.                                      |
| `photo`      | `string` | Path del asset de foto.                          |

### `Hero`

| Campo              | Tipo       | Notas                               |
| ------------------ | ---------- | ----------------------------------- |
| `kicker`           | `string`   | Línea superior en mono.             |
| `headlineLead`     | `string`   | Cláusula inicial del h1.            |
| `headlineEmphasis` | `string`   | Cláusula con acento de color.       |
| `subhead`          | `string`   | Párrafo introductorio.              |
| `ctas`             | `CTA[]`    | Botones/links del hero.             |

`CTA`:

| Campo      | Tipo      | Notas                            |
| ---------- | --------- | -------------------------------- |
| `label`    | `string`  | Texto visible.                   |
| `href`     | `string`  | Link interno (`#contact`) o URL. |
| `external` | `boolean` | Opcional.                        |

### `Stat`

| Campo      | Tipo     | Notas                                     |
| ---------- | -------- | ----------------------------------------- |
| `value`    | `string` | Valor visible, puede incluir `+` o `,`.  |
| `label`    | `string` | Etiqueta principal.                       |
| `sublabel` | `string` | Contexto adicional.                       |

### `HowIWork`

| Campo       | Tipo            | Notas                  |
| ----------- | --------------- | ---------------------- |
| `panels`    | `WorkPanel[]`   | Paneles numerados.     |
| `closingNote` | `string`      | Párrafo de cierre.     |

`WorkPanel`:

| Campo     | Tipo     | Notas |
| --------- | -------- | ----- |
| `heading` | `string` |       |
| `body`    | `string` |       |

### `AboutAside`

| Campo  | Tipo     | Notas |
| ------ | -------- | ----- |
| `text` | `string` |       |
| `photo`| `string` |       |

### `Project`

| Campo         | Tipo             | Notas                                   |
| ------------- | ---------------- | --------------------------------------- |
| `id`          | `string`         | Slug estable.                           |
| `name`        | `string`         | Nombre del proyecto.                    |
| `context`     | `string`         | Empresa o "Personal".                   |
| `tech`        | `string[]`       | Tags de tecnología.                     |
| `description` | `string`         |                                         |
| `status`      | `ProjectStatus`  | `"live" | "in-progress"`.               |
| `link`        | `string`         | Opcional.                               |
| `featured`    | `boolean`        | Determina si aparece en Home.           |

### `Job`

| Campo        | Tipo             | Notas                                      |
| ------------ | ---------------- | ------------------------------------------ |
| `id`         | `string`         | Slug estable.                              |
| `title`      | `string`         |                                            |
| `company`    | `string`         |                                            |
| `location`   | `string`         | Opcional.                                  |
| `startDate`  | `string`         | `"YYYY-MM"`.                               |
| `endDate`    | `string \| null` | `null` = "Present".                        |
| `bullets`    | `string[]`       | Logros.                                    |
| `tech`       | `string[]`       |                                            |
| `projectIds` | `string[]`       | Referencias a `Project.id` por resolver.   |

### `EducationEntry`

| Campo         | Tipo     | Notas         |
| ------------- | -------- | ------------- |
| `degree`      | `string` |               |
| `institution` | `string` |               |
| `startDate`   | `string` | `"YYYY-MM"`.  |
| `endDate`     | `string` | `"YYYY-MM"`.  |

### `CourseEntry`

| Campo         | Tipo     | Notas          |
| ------------- | -------- | -------------- |
| `name`        | `string` |                |
| `institution` | `string` |                |
| `date`        | `string` | Año `"YYYY"`.  |

### `ContactSection`

| Campo    | Tipo     | Notas |
| -------- | -------- | ----- |
| `heading`| `string` |       |
| `body`   | `string` |       |

## Fuente de Datos

Los datos se sirven como JSON estático desde `apps/web/public/data/` para mantener el data flow del monorepo y que el contenido no esté hardcodeado en componentes.

| Recurso      | Tipo          | Path                         | Shape               |
| ------------ | ------------- | ---------------------------- | ------------------- |
| `profile`    | JSON estático | `/data/profile.json`         | `Profile`           |
| `hero`       | JSON estático | `/data/hero.json`            | `Hero`              |
| `stats`      | JSON estático | `/data/stats.json`           | `Stat[]`            |
| `howIWork`   | JSON estático | `/data/how-i-work.json`      | `HowIWork`          |
| `aboutAside` | JSON estático | `/data/about-aside.json`     | `AboutAside`        |
| `projects`   | JSON estático | `/data/projects.json`        | `Project[]`         |
| `experience` | JSON estático | `/data/experience.json`      | `Job[]`             |
| `education`  | JSON estático | `/data/education.json`       | `EducationEntry[]`  |
| `courses`    | JSON estático | `/data/courses.json`         | `CourseEntry[]`     |
| `contact`    | JSON estático | `/data/contact.json`         | `ContactSection`    |

El contenido inicial se transcribe literalmente desde `docs/specs/init/content-data.md`.

## Lógica Derivada

Funciones puras en `packages/data-model/src/domain.ts` y `format.ts`; hooks derivados en `apps/web/src/domain/`.

- `formatMonthYear(date: string): string` — `"2025-08"` → `"Aug 2025"`.
- `formatDateRange(start: string, end: string | null): string` — `"Aug 2025 — Present"`.
- `getFeaturedProjects(projects: Project[]): Project[]` — filtra `featured === true`.
- `getJobProjects(job: Job, projects: Project[]): Project[]` — resuelve `job.projectIds` contra `projects`.
- `groupExperienceByCompany?` — no es necesario; se renderiza en orden crónologico inverso.

## Pantallas / Componentes

| Componente               | Nivel       | Ubicación                                |
| ------------------------ | ----------- | ---------------------------------------- |
| `tokens.ts`              | Theme       | `packages/ui/src/theme/tokens.ts`        |
| `cssVariables.ts`        | Theme       | `packages/ui/src/theme/cssVariables.ts`  |
| `Kicker`                 | Atom        | `packages/ui/src/atoms/Kicker.tsx`       |
| `Link`                   | Atom        | `packages/ui/src/atoms/Link.tsx`         |
| `Stat`                   | Molecule    | `packages/ui/src/molecules/Stat.tsx`     |
| `ProjectCard`            | Molecule    | `packages/ui/src/molecules/ProjectCard.tsx` |
| `TimelineItem`           | Molecule    | `packages/ui/src/molecules/TimelineItem.tsx` |
| `HeroSection`            | Organism    | `apps/web/src/components/HeroSection.tsx`    |
| `StatsSection`           | Organism    | `apps/web/src/components/StatsSection.tsx`   |
| `HowIWorkSection`        | Organism    | `apps/web/src/components/HowIWorkSection.tsx` |
| `AboutSection`           | Organism    | `apps/web/src/components/AboutSection.tsx`   |
| `ProjectsSection`        | Organism    | `apps/web/src/components/ProjectsSection.tsx` |
| `ExperienceSection`      | Organism    | `apps/web/src/components/ExperienceSection.tsx` |
| `EducationSection`       | Organism    | `apps/web/src/components/EducationSection.tsx` |
| `CoursesSection`         | Organism    | `apps/web/src/components/CoursesSection.tsx`   |
| `ContactSection`         | Organism    | `apps/web/src/components/ContactSection.tsx`   |
| `Nav`                    | Organism    | `apps/web/src/components/Nav.tsx`              |
| `HomePage`               | Route       | `apps/web/src/routes/HomePage.tsx`             |
| `CVPage`                 | Route       | `apps/web/src/routes/CVPage.tsx`               |
| `NotFoundPage`           | Route       | `apps/web/src/routes/NotFoundPage.tsx`         |

Nota: algunos átomos/moléculas del template existente (`Button`, `StatPill`, `Dialog`) pueden reusarse si su API genérica lo permite; la mayoría de los componentes del sitio son nuevos.

## Secuencia de Implementación

| #   | Task file                          | Capa / Skill                | Depende de |
| --- | ---------------------------------- | --------------------------- | ---------- |
| 1   | `tasks/01-data-model.md`           | `add-feature`               | —          |
| 2   | `tasks/02-sample-data.md`          | `add-feature`               | 1          |
| 3   | `tasks/03-services.md`             | `add-query`                 | 1          |
| 4   | `tasks/04-queries.md`              | `add-query`                 | 3          |
| 5   | `tasks/05-domain-hooks.md`         | `add-feature`               | 1          |
| 6   | `tasks/06-ui-components.md`        | `add-ui-component`          | —          |
| 7   | `tasks/07-organisms.md`            | `add-ui-component`          | 1, 6       |
| 8   | `tasks/08-routes.md`               | `add-route`                 | 4, 5, 7    |
| 9   | `tasks/09-final-verification.md`   | verificación                | all        |

Steps 5 y 6 son independientes entre sí y de 3-4; pueden ejecutarse en paralelo.

## Criterios de Aceptación Globales

- [ ] Tipos de `Profile`, `Hero`, `Stat`, `HowIWork`, `AboutAside`, `Project`, `Job`, `EducationEntry`, `CourseEntry`, `ContactSection` definidos una sola vez en `packages/data-model/src/types.ts`.
- [ ] Barrel exports en `packages/data-model/src/index.ts` y `packages/ui/src/index.ts` actualizados.
- [ ] Datos viven en `apps/web/public/data/*.json`, transcritos desde `content-data.md`.
- [ ] Fetchers viven en `apps/web/src/services/dataService.ts`, nunca en componentes.
- [ ] Query keys centralizadas en `apps/web/src/queries/keys.ts`.
- [ ] Lógica derivada vive en `packages/data-model/src/domain.ts`/`format.ts` y se expone a través de hooks en `apps/web/src/domain/`.
- [ ] Componentes de `packages/ui` agnósticos del dominio; organismos en `apps/web/src/components`.
- [ ] Cada pantalla tiene ruta propia deep-linkable en `App.tsx` (`/`, `/cv`).
- [ ] Sin hex/font hardcodeados — todos los tokens salen de `packages/ui/src/theme/tokens.ts`.
- [ ] `/cv` tiene estilos de impresión (`@media print`) con fondo blanco, texto negro, y clases `.no-print`.
- [ ] Named exports, nunca `export default`.
- [ ] `pnpm typecheck` y `pnpm build` pasan sin errores.

## Preguntas Abiertas / Supuestos

- `profile.email` y `profile.github` permanecen como placeholders hasta que el usuario los confirme.
- Los nombres de `board-game` y `flight-sim-fan-page` permanecen como placeholders `[...]`.
- El PDF se implementa vía print-CSS en `/cv` + `window.print()` (approach A del design spec); el approach programático queda como trabajo futuro.
- Las fuentes Spectral, Work Sans e IBM Plex Mono se cargan vía Google Fonts en `apps/web/index.html`.
- Los assets de fotos (`fernando-photo.jpg`) se asumen copiados manualmente a `apps/web/public/`; este plan no cubre optimización de assets.

# Plan: CV PDF Redesign (two-column resume)

## Objetivo

Rediseñar la página `/cv` (que hoy se "exporta a PDF" vía `window.print()`) para que el
documento impreso — y su versión en pantalla — adopte el layout del PDF de referencia
(`Fernando_Matías_Pailhe_-_Mobile_App_Engineer.pdf`): encabezado con foto + nombre +
línea de rol/ubicación/teléfono, y debajo **dos columnas**: sidebar gris claro con
DETAILS / SKILLS / LANGUAGES, y columna principal con PROFILE / EMPLOYMENT HISTORY /
EDUCATION / COURSES. Se presta atención especial a la **sectorización y segmentación
visual**: cada bloque de texto tiene un heading con ícono + título en versalitas
espaciadas, y cada job se separa en sub-bloques claros (intro → bullets → Key
Technologies → Projects / Skills developed).

## Fuente de Requerimientos

- PDF de referencia: `/Volumes/1TB-External/Downloads/CV/2026/Fernando_Matías_Pailhe_-_Mobile_App_Engineer.pdf`
  (4 páginas, layout de 2 columnas con sidebar ~35% sobre fondo gris claro).
- Pedido del usuario: agregar al JSON los datos que hoy faltan (skills, languages,
  phone, summary) porque hidratan tanto el PDF como la página de CV.

## Diseño de referencia (qué reproduce este plan)

Estructura visual del PDF objetivo:

```
┌────────────────────────────────────────────────────────────┐
│                    [foto circular ~90px]                   │
│                 FERNANDO MATÍAS PAILHE                     │  ← display, versalitas, tracking amplio
│      MOBILE APP ENGINEER • BUENOS AIRES, ARG • PHONE       │  ← mono/ui xs, uppercase
├──────────────┬─────────────────────────────────────────────┤
│ (sidebar     │ ○ PROFILE                                   │
│  bg gris)    │   párrafo summary                           │
│ ○ DETAILS    │                                             │
│   ciudad     │ ○ EMPLOYMENT HISTORY                        │
│   país       │   ┌─ Job title at Company                   │
│   phone      │   │  Mon YYYY — Mon YYYY  (mono, italic-ish)│
│   email      │   │  summary paragraph                      │
│              │   │  • bullet                               │
│ ○ SKILLS     │   │  Key Technologies: a, b, c              │
│   lista      │   │  Projects:                              │
│              │   │   • name (stack)                        │
│ ○ LANGUAGES  │   │  Skills developed: • a • b   (opcional) │
│   Name ▓▓▓░░ │   └─ (separación entre jobs: espacio, no HR)│
│   Name ▓▓▓▓░ │                                             │
│              │ ○ EDUCATION                                 │
│              │ ○ COURSES                                   │
└──────────────┴─────────────────────────────────────────────┘
```

Detalles clave de sectorización a respetar:

- **Headings de sección**: ícono pequeño en círculo con borde + título en uppercase,
  `letter-spacing` amplio, `font-ui`/mono, tamaño ~xs–sm. Mismo componente en sidebar
  y columna principal (`CVSectionHeading`).
- **Separación entre jobs**: whitespace generoso + borde superior sutil (`border-line`),
  NO líneas duras entre cada bloque. La fecha va debajo del título (no en columna
  izquierda como el `TimelineItem` actual).
- **Sub-bloques dentro de un job**: `summary` como párrafo, bullets con `list-disc`,
  `Key Technologies:` como línea de texto corrido (label en semibold + valores
  separados por coma — no chips), `Projects:` como mini-lista con bullets.
- **Sidebar**: fondo `paper` (nuevo token, ver abajo), secciones apiladas, items de
  DETAILS como texto plano una por línea, LANGUAGES con barra de nivel de 5 segmentos.
- **Impresión**: el fondo del sidebar debe sobrevivir al print
  (`print-color-adjust: exact`), `@page` con márgenes chicos, `break-inside: avoid`
  por job/entrada.

### Skills: marquesina en pantalla, lista en print

Decisión resuelta (pedido del usuario): en la **versión web** los skills NO van en
el sidebar — se renderizan como una **tira horizontal con scroll infinito**
(marquee: la lista duplicada que se desplaza y vuelve a empezar) dentro de la
columna principal, con **ancho igual a los bloques de texto** (ocupa el ancho de
la columna de contenido, no full-bleed ni ancho del sidebar). En la **versión
impresa** los skills vuelven al sidebar como lista plana (`CVSkillsBlock`), porque
el marquee no tiene sentido en papel.

Implementación: `CVSkillsMarquee` en la columna principal con `print:hidden`;
`CVSkillsBlock` en el sidebar envuelto en `hidden print:block`. El track del
marquee usa un `@keyframes cv-marquee` en `globals.css` (`translateX(0 → -50%)`,
lista renderizada dos veces), respeta `prefers-reduced-motion` (queda estática) y
los items se separan con `·` o gap — texto plano, mismo vocabulario mono/ink-dim.

## Decisión de layout (resuelta — no re-decidir)

La página `/cv` adopta el layout de dos columnas **en pantalla y en print** con el
mismo DOM (nada de markup duplicado solo-para-print). Desktop: `grid-cols-[300px_1fr]`.
Mobile (`≤680px`): una columna; el sidebar va **primero en el DOM**, así que en mobile
aparece entre el header y PROFILE — comportamiento aceptable y más simple que reordenar.

## Entidades

Cambios en `packages/data-model/src/types.ts`:

### Profile (editar — agregar campos)

| Campo    | Tipo   | Notas                                              |
| -------- | ------ | -------------------------------------------------- |
| phone    | string | Nuevo. Teléfono para DETAILS y la línea del header |
| summary  | string | Nuevo. Párrafo PROFILE de la columna principal     |

### Skill (nuevo)

| Campo | Tipo   | Notas                        |
| ----- | ------ | ---------------------------- |
| name  | string | Ej. "React Native", "Kotlin" |

### Language (nuevo)

| Campo | Tipo   | Notas                                          |
| ----- | ------ | ---------------------------------------------- |
| name  | string | Ej. "Spanish"                                  |
| level | number | 0–5, se renderiza como barra de 5 segmentos    |
| label | string | Ej. "Native", "Professional working"           |

### Job (editar — agregar campos opcionales)

| Campo           | Tipo       | Notas                                                        |
| --------------- | ---------- | ------------------------------------------------------------ |
| summary         | `string?`  | Párrafo introductorio del rol (antes de los bullets)         |
| skillsDeveloped | `string[]?`| Lista tipo "Skills developed" (roles no-tech: filmmaker etc) |

Los campos existentes (`bullets`, `tech`, `projectIds`) se mantienen.

## Fuente de Datos

| Recurso   | Tipo          | Path                | Shape        | Estado    |
| --------- | ------------- | ------------------- | ------------ | --------- |
| profile   | JSON estático | `/data/profile.json`| `Profile`    | editar    |
| skills    | JSON estático | `/data/skills.json` | `Skill[]`    | **crear** |
| languages | JSON estático | `/data/languages.json` | `Language[]` | **crear** |
| experience| JSON estático | `/data/experience.json` | `Job[]`   | editar    |

El contenido textual de `summary`, `skills` y `languages` se toma del PDF de
referencia (los textos ya están transcritos en `doc/detailed-plan/cv-pdf-redesign/reference-content.md`).

## Lógica Derivada

- Nada nuevo: se reusan `useSortedExperience`, `useJobProjects`,
  `useFormattedDateRange` de `apps/web/src/domain/useSiteDomain.ts`.

## Pantallas / Componentes

| Componente          | Nivel     | Ubicación                                  | Estado     |
| ------------------- | --------- | ------------------------------------------ | ---------- |
| CVPage              | Route     | `apps/web/src/routes/CVPage.tsx`           | rewrite    |
| CVHeader            | Organismo | `apps/web/src/components/CVHeader.tsx`     | crear      |
| CVDetailsBlock      | Organismo | `apps/web/src/components/CVDetailsBlock.tsx` | crear    |
| CVSkillsBlock       | Organismo | `apps/web/src/components/CVSkillsBlock.tsx` | crear (solo print, `hidden print:block`) |
| CVSkillsMarquee     | Organismo | `apps/web/src/components/CVSkillsMarquee.tsx` | crear (solo screen, `print:hidden`) |
| CVLanguagesBlock    | Organismo | `apps/web/src/components/CVLanguagesBlock.tsx` | crear  |
| ExperienceItem      | Organismo | `apps/web/src/components/ExperienceItem.tsx` | rewrite  |
| ExperienceSection   | Organismo | `apps/web/src/components/ExperienceSection.tsx` | editar (heading con ícono) |
| EducationSection/Item | Organismo | `apps/web/src/components/Education*.tsx` | editar (mismo patrón de item que job, compacto) |
| CoursesSection      | Organismo | `apps/web/src/components/CoursesSection.tsx` | editar (heading + items compactos) |
| CVSectionHeading    | Molecule  | `packages/ui/src/molecules/CVSectionHeading.tsx` | crear |
| LevelDots           | Atom      | `packages/ui/src/atoms/LevelDots.tsx`      | crear      |
| CVIcons             | lib/icons | `apps/web/src/components/CVIcons.tsx`      | crear (SVG inline, sin deps) |

`ExperienceSection`/`EducationSection`/`CoursesSection` solo las usa `CVPage`
(verificado por grep), así que se modifican en lugar sin romper otras pantallas.

## Token nuevo

Agregar a `packages/ui/src/theme/tokens.ts` (y espejar en `darkTokens.ts`):

```ts
// Sidebar del CV — gris cálido claro, debe verse también en impresión
paper: "oklch(94.5% 0.008 75)",
```

Dark: `paper: "oklch(24% 0.010 75)"`. En el `@media print` de `globals.css`:
`--color-paper: #efefef !important` + `-webkit-print-color-adjust: exact` en el
sidebar. Tailwind expone `bg-paper` automáticamente vía `tokenExports.ts`.

## Secuencia de Implementación

| #   | Task file                          | Capa / Skill              | Depende de |
| --- | ---------------------------------- | ------------------------- | ---------- |
| 1   | tasks/01-data-model.md             | `add-feature` (paso tipos)| —          |
| 2   | tasks/02-json-data.md              | `add-feature` (data)      | 1          |
| 3   | tasks/03-services-queries.md       | `add-query`               | 1          |
| 4   | tasks/04-ui-primitives.md          | `add-ui-component`        | —          |
| 5   | tasks/05-cv-organisms.md           | `add-ui-component`        | 1, 4       |
| 6   | tasks/06-cv-page-layout.md         | `responsive-layout`       | 3, 5       |
| 7   | tasks/07-print-css.md              | `theming` (print layer)   | 6          |
| 8   | tasks/08-final-verification.md     | verificación              | all        |

Tasks 2, 3 y 4 son independientes entre sí (solo dependen de 1 o de nada) — pueden
correr en paralelo. 5 depende de tipos (1) y primitivas (4). 6 necesita queries (3)
y organismos (5). 7 ajusta el print sobre el layout ya armado (6).

## Criterios de Aceptación Globales

- [ ] El PDF impreso de `/cv` reproduce el layout de referencia: header centrado con
      foto, sidebar gris con DETAILS/SKILLS/LANGUAGES, columna principal con
      PROFILE/EMPLOYMENT HISTORY/EDUCATION/COURSES.
- [ ] Todos los headings de sección usan `CVSectionHeading` (ícono + uppercase
      tracking) — mismo vocabulario visual en sidebar y columna principal.
- [ ] En pantalla los skills son una marquesina horizontal infinita al ancho de
      la columna de texto; en print vuelven al sidebar como lista plana.
- [ ] `skills.json`, `languages.json` creados e hidratan la página; `profile.json`
      tiene `phone` y `summary`; `experience.json` tiene `summary` donde aplica.
- [ ] El fondo del sidebar se imprime (no queda blanco) y los bloques de job no se
      cortan entre páginas (`break-inside: avoid`).
- [ ] Tipos definidos una sola vez en `@ferpa/data-model`; fetchers en
      `services/dataService.ts`; query keys en `queries/keys.ts`.
- [ ] Componentes de `packages/ui` agnósticos del dominio (props genéricas).
- [ ] Sin hex/font hardcodeados fuera de `tokens.ts` y del bloque `@media print`
      existente de `globals.css`.
- [ ] Named exports; `pnpm typecheck` y `pnpm build` pasan.
- [ ] Mobile (≤680px): layout a una columna sin desbordes.

## Preguntas Abiertas / Supuestos

- Se asumió que el layout de 2 columnas aplica también a la versión en pantalla de
  `/cv` (mismo DOM que el print). Si el usuario quisiera mantener la página web con
  el layout actual y solo cambiar el PDF, habría que duplicar markup — marcado para
  confirmar.
- Los textos de `summary`/`skills` se transcriben del PDF de referencia
  (`reference-content.md`); el usuario puede querer editar el copy después.
- El teléfono del PDF (`01161716045`) se copia a `profile.json` tal cual; puede
  querer formatearlo distinto.

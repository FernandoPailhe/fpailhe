---
name: make-detailed-plan
description: >
  Produce un plan de implementación detallado en archivos para una feature del monorepo Ferpa.
  Escribe doc/detailed-plan/${plan-name}/plan.md (overview global, entidades, data flow,
  componentes, secuencia de capas) y un doc/detailed-plan/${plan-name}/tasks/{NN}-{task}.md por
  paso de implementación, cada uno autocontenido para que un LLM más barato/pequeño pueda
  ejecutarlo sin necesitar el contexto completo de la conversación.
  Usar para "hacé un plan detallado para la feature X", "planificá Y antes de construirlo",
  "descomponé Z en tareas", "escribí un plan doc para X", "prepará tasks para que otro modelo
  implemente esto".
  Sigue la arquitectura del monorepo Ferpa: data-model → services → queries → domain →
  components → routes. El entregable es documentación, no código.
triggers:
  - user
  - model
allowed-tools:
  - read
  - write
  - edit
  - grep
  - glob
---

# Make Detailed Plan

Convertís un pedido de feature en un **plan escrito y autocontenido en disco** — no en código,
y no en delegación de skills en vivo. El output lo consume después un LLM potencialmente más
chico/barato que no tiene tu contexto actual, así que cada task file debe sostenerse solo.

Este skill lleva el conocimiento arquitectónico del monorepo Ferpa
(`.devin/rules/rules.md` + `.devin/rules/project-map.md`) y las convenciones de los skills
existentes (`add-feature`, `add-query`, `add-route`, `add-store`, `add-ui-component`,
`responsive-layout`, `theming`), pero en vez de ejecutar pasos, **los escribe** en formato
optimizado para hand-off.

## Tu Rol

```
Pedido del usuario
     ↓
make-detailed-plan   ← ESTÁS ACÁ
     ↓
doc/detailed-plan/${plan-name}/plan.md          (plan global, contexto compartido)
doc/detailed-plan/${plan-name}/tasks/01-...md    (un archivo por paso)
doc/detailed-plan/${plan-name}/tasks/02-...md
...
```

No escribís código de la feature. No ejecutás otros skills — escribís task files que le dicen
a un futuro executor (humano o LLM) qué skill/reglas seguir y cómo se ve "hecho".

## Principio Core: Plan vs Tasks — Evitar Redundancia

Esta es la barra de calidad principal: **la información correcta en el archivo correcto, una
sola vez.**

- `plan.md` es la **única fuente de verdad** para todo lo compartido entre pasos: shapes de
  entidades, contratos de endpoints/JSON, convenciones de naming, la secuencia completa, y
  criterios de aceptación globales.
- Cada `tasks/{NN}-{name}.md` contiene **solo lo específico de ese paso**: qué archivos
  crear/editar, qué signatures/fields exactos usar para _esa_ capa, y cómo verificar _ese_
  paso. **Referencia** plan.md para contexto compartido en vez de repetirlo
  (ej. "Ver `../plan.md#entidades` para la interfaz completa de `Product`").
- Nunca repetir toda la spec de entidad/endpoint en cada task file. Sí repetir los 2-4
  datos concretos que el task necesita inline (ej. la interface exacta que debe implementar)
  para que el executor no tenga que cruzar referencias en el camino crítico.
- Optimizar ratio esfuerzo/calidad: razonamiento detallado (edge cases, por qué se tomó una
  decisión, trade-offs) una vez en `plan.md`; task files mecánicos y tipo checklist para que
  un modelo más barato los siga literalmente.

## Arquitectura del Monorepo Ferpa

Antes de planificar, tener presente esta estructura de capas:

```
packages/data-model/   → Dominio puro: tipos, cálculos, formatters (sin React)
packages/ui/           → Design system: theme + atoms + molecules (sin dominio)
apps/web/              → Composición: services → queries → domain → components → routes
```

Dependencias permitidas:
```
apps/web  →  @ferpa/ui           ✅
apps/web  →  @ferpa/data-model   ✅
@ferpa/ui →  @ferpa/data-model   ❌ PROHIBIDO
```

Data flow estricto:
```
JSON/API → services/ → queries/ → domain/ → components/ → routes/
```

## Workflow

### Step 1 — Analizar Requerimientos

Leer docs relevantes de requerimientos antes de planificar:

- Buscar en el repo si existe documentación de la feature (en `doc/`, README, issues, etc.).
- Si no hay docs de requerimientos, pedirle al usuario los datos faltantes (endpoints, campos,
  pantallas) en vez de inventarlos — este plan lo lee alguien sin otro contexto.

Identificar:

- **Entidades** (modelos de dominio, con campos y tipos) → van en `@ferpa/data-model`
- **Fuente de datos** (JSON estático en `public/data/` o API real vía `VITE_API_BASE_URL`)
- **Lógica derivada** (cálculos, filtros, agregaciones) → funciones puras en `data-model` +
  hooks en `domain/`
- **Componentes UI** (atoms/molecules genéricos vs organismos de dominio)
- **Pantallas/Rutas** (qué ve el usuario, URL de cada vista)
- **Dependencias** (¿depende de otra feature/entidad existente?)

### Step 2 — Crear `doc/detailed-plan/${plan-name}/plan.md`

`${plan-name}` es un slug kebab-case de la feature (ej. `product-catalog`,
`tournament-standings`). Crear la estructura:

```
doc/detailed-plan/${plan-name}/
  plan.md
  tasks/
    01-data-model.md
    02-sample-data.md
    03-services.md
    04-queries.md
    05-domain-hooks.md
    06-ui-components.md
    07-organisms.md
    08-routes.md
    09-final-verification.md
```

(Ajustar nombres/cantidad de steps a la feature — una feature sin lógica derivada salta
`05-domain-hooks`, una que usa entidades existentes salta `01-data-model`, etc.)

Template de `plan.md`:

```markdown
# Plan: {NombreFeature}

## Objetivo

{1-3 oraciones: qué hace esta feature y por qué, desde la perspectiva del usuario.}

## Fuente de Requerimientos

- {link(s) a docs leídos en Step 1, o "ninguno — capturado del pedido del usuario".}

## Entidades

### {Entidad1}

| Campo | Tipo   | Notas |
| ----- | ------ | ----- |
| id    | string | ...   |
| ...   | ...    | ...   |

(repetir por entidad)

Archivo destino: `packages/data-model/src/types.ts`
Si necesita cálculos → `packages/data-model/src/domain.ts`
Si necesita formatters → `packages/data-model/src/format.ts`

## Fuente de Datos

| Recurso      | Tipo         | Path / Endpoint     | Shape              |
| ------------ | ------------ | ------------------- | ------------------ |
| {entidades}  | JSON estático | `/data/{x}.json`   | `{Entidad}[]`      |
| {entidades}  | API          | `GET /v1/{x}`       | `{Entidad}[]`      |

## Lógica Derivada

- {describir cálculos, filtros, agregaciones que necesita la feature}
- {indicar si va en `data-model/domain.ts` (función pura) o `apps/web/domain/` (hook)}

## Pantallas / Componentes

| Componente              | Nivel     | Ubicación                        |
| ----------------------- | --------- | -------------------------------- |
| {Feature}Page           | Route     | `apps/web/src/routes/`           |
| {Feature}Card           | Organismo | `apps/web/src/components/`       |
| {ComponenteGenérico}    | Atom      | `packages/ui/src/atoms/`         |
| {ComponenteGenérico}    | Molecule  | `packages/ui/src/molecules/`     |

## Secuencia de Implementación

| #   | Task file                        | Capa / Skill                | Depende de |
| --- | -------------------------------- | --------------------------- | ---------- |
| 1   | tasks/01-data-model.md           | `add-feature` (paso 1)     | —          |
| 2   | tasks/02-sample-data.md          | `add-feature` (paso 2)     | 1          |
| 3   | tasks/03-services.md             | `add-query` (paso 1)       | 1          |
| 4   | tasks/04-queries.md              | `add-query` (pasos 2-3)    | 3          |
| 5   | tasks/05-domain-hooks.md         | `add-feature` (paso 5)     | 4          |
| 6   | tasks/06-ui-components.md        | `add-ui-component`          | —          |
| 7   | tasks/07-organisms.md            | `add-ui-component`          | 1, 6       |
| 8   | tasks/08-routes.md               | `add-route`                 | 5, 7       |
| 9   | tasks/09-final-verification.md   | verificación                | all        |

Nota: pasos cuyo "Depende de" no se solapan (ej. 6 no necesita nada de 3-5)
pueden ejecutarse en paralelo.

## Criterios de Aceptación Globales

- [ ] Tipos definidos una sola vez en `@ferpa/data-model`
- [ ] Fetchers en `services/dataService.ts`, nunca en componentes
- [ ] Query keys centralizadas en `queries/keys.ts`
- [ ] Lógica derivada en `domain/` hooks, no en componentes
- [ ] Componentes de `packages/ui` agnósticos del dominio (props genéricas, nunca entidades)
- [ ] Organismos en `apps/web/src/components/`, no en `packages/ui`
- [ ] Toda pantalla tiene ruta propia deep-linkable en `App.tsx`
- [ ] Sin hex/font hardcodeados — solo tokens de `packages/ui/src/theme/tokens.ts`
- [ ] Named exports, nunca `export default`
- [ ] `pnpm typecheck` y `pnpm build` pasan sin errores

## Preguntas Abiertas / Supuestos

- {lo que el autor del plan tuvo que asumir por falta de info — marcar para revisión.}
```

### Step 3 — Escribir Cada `tasks/{NN}-{name}.md`

Cada task file debe ser **completamente autocontenido**: asumir que el executor leyó solo
este archivo (más un link a `plan.md`), no el historial de conversación. Template:

````markdown
# Task {NN}: {Título Corto}

> Parte del plan: `../plan.md` — leerlo para definiciones de entidades/datos si es necesario.

## Skill / Capa

Seguir el skill `{nombre-skill}` (ver `.devin/skills/{nombre-skill}.md`) y las reglas de
`.devin/rules/rules.md`.

## Objetivo

{1-2 oraciones: qué produce exactamente este paso.}

## Depende De

- Task {N}: {razón corta, ej. "necesita la interfaz Product en @ferpa/data-model"}

## Archivos a Crear/Editar

- `packages/data-model/src/types.ts` — editar (agregar interfaz)
- `packages/data-model/src/index.ts` — editar (verificar barrel export)
- ...

## Detalles de Implementación

{Instrucciones mecánicas y concretas. Incluir inline las signatures/fields exactos que ESTE
paso necesita (no hacer que el executor busque en plan.md), ej.:}

```ts
export interface Product {
  id: string;
  name: string;
  price: number;
}
```

- {Cualquier decisión no obvia de la que el executor no debe desviarse, y por qué, en una
  línea.}

## Fuera de Alcance

- {Listar explícitamente qué NO tocar acá, para prevenir scope creep — ej. "No crear el
  fetcher ni la query, eso es Task 03-04."}

## Verificación

- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] {chequeo específico de la feature, ej. "la interfaz exportada es visible desde
  `@ferpa/data-model`"}

## Handoff

- Produce: {qué necesita el próximo task de este, ej. "interfaz Product exportada desde
  `@ferpa/data-model` para Task 03"}
````

Lineamientos para llenar esto bien:

- **Inline > referencia** para todo lo que está en el camino crítico de ese task (interface
  exacta, campos exactos, paths de archivos). **Referencia > inline** para contexto
  compartido (por qué la entidad tiene estos campos, la lista completa de endpoints).
- Mantener "Detalles de Implementación" lo suficientemente concreto para que un modelo más
  chico no tenga que hacer juicios arquitectónicos — esos juicios ya deben estar resueltos
  en `plan.md` o en esta sección.
- Siempre incluir lista explícita de "Fuera de Alcance"; esto es lo que evita que modelos
  más baratos se vayan a otras capas.
- Siempre incluir comandos de verificación copy-pasteables, no solo "correr tests".
- Si un paso mapea 1:1 a un skill existente (`add-feature`, `add-query`, `add-route`,
  `add-store`, `add-ui-component`, `responsive-layout`, `theming`), nombrarlo explícitamente
  para que el executor lo use como referencia.
- El task final siempre debe ser verificación de integración, cubriendo el checklist
  pre-commit de `.devin/rules/rules.md`.

### Step 4 — Sanity Check del Plan Antes de Terminar

- [ ] El "Depende De" de cada task file coincide con la tabla de secuencia en `plan.md`.
- [ ] Ningún task file repite más de ~3-4 líneas de contenido verbatim de `plan.md` o de
      otro task file — si lo hace, reemplazar con referencia.
- [ ] Toda entidad/endpoint de `plan.md` es usado por al menos un task.
- [ ] Las fronteras entre paquetes se respetan: `@ferpa/data-model` no importa React ni
      `@ferpa/ui`; `@ferpa/ui` no importa `@ferpa/data-model`; solo `apps/web` combina ambos.
- [ ] Presentar al usuario un resumen corto (nombre del plan, path, cantidad de tasks) — no
      pegar el contenido completo de los archivos en el chat a menos que lo pida.

## Lo Que Este Skill Nunca Hace

- Nunca escribe código fuente de la feature directamente.
- Nunca ejecuta otros skills para implementar el plan — solo los referencia por nombre dentro
  de los task files para que un executor futuro los use.
- Nunca saltea Step 1 (leer requerimientos) incluso si el pedido del usuario parece completo.

## Documentos de Referencia

- `.devin/rules/rules.md` — reglas de arquitectura invariantes del monorepo.
- `.devin/rules/project-map.md` — mapa de archivos clave del proyecto.
- `.devin/skills/add-feature.md` — receta para agregar entidad de punta a punta.
- `.devin/skills/add-query.md` — receta para agregar TanStack Query hook.
- `.devin/skills/add-route.md` — receta para agregar ruta/página.
- `.devin/skills/add-store.md` — receta para agregar Zustand store.
- `.devin/skills/add-ui-component.md` — receta para agregar componente UI.
- `.devin/skills/responsive-layout.md` — guía de layout responsive.
- `.devin/skills/theming.md` — guía para modificar/extender el theme.

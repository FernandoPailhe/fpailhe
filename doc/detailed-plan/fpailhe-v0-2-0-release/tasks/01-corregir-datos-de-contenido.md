# Task 01: Corregir datos de contenido

> Parte del plan: `../plan.md` — leerlo para contexto de entidades y alcance.

## Skill / Capa

Edición de datos JSON estáticos (`apps/web/public/data/`). No requiere React ni TypeScript; solo validar JSON y consistencia con el dominio.

## Objetivo

Corregir los datos de contenido con errores detectados en la auditoría:

1. `experience.json`: la entrada `tres-de-febrero` tiene `endDate: null` aunque comenzó en 2017; debe tener una fecha de fin real.
2. `experience.json`: revisar que no haya otros casos de fechas de fin vacías incorrectas.
3. `projects.json`: reescribir la descripción de `tune-up` para que tenga inglés correcto y siga el estándar de resultado medible del resto de proyectos.

## Depende De

— (ninguno; puede ejecutarse primero).

## Archivos a Crear/Editar

- `apps/web/public/data/experience.json` — editar
- `apps/web/public/data/projects.json` — editar

## Detalles de Implementación

### 1. `experience.json` — `tres-de-febrero`

Actual:

```json
{
  "id": "tres-de-febrero",
  "title": "Filmmaker",
  "company": "Municipalidad de Tres de Febrero",
  "startDate": "2017-07",
  "endDate": null,
  ...
}
```

- El `endDate` no puede ser `null` porque ese trabajo ya terminó (comenzó en 2017 y actualmente se muestra como "Present" al mismo nivel que Techint).
- El dato exacto no fue provisto en la auditoría. **Supuesto de plan**: usar `"2020-01"` como fecha razonable de transición al trabajo freelance, pero dejar un comentario en el commit o en el task handoff indicando que debe verificarse con Fernando.
- Reemplazar `endDate: null` por `endDate: "2020-01"`.

### 2. `experience.json` — revisión general de fechas

Revisar cada entrada:

- `techint`: `endDate: null` → correcto (trabajo actual), no tocar.
- `sitio-uno`: `"2025-08"` → correcto.
- `freelance-fullstack`: `"2025-07"` → correcto.
- `my-stadium-golf`: `"2023-03"` → correcto.
- `tres-de-febrero`: corregir según punto 1.
- `freelance-photo-film`: `"2020-01"` → correcto.

### 3. `projects.json` — `tune-up`

Actual:

```json
{
  "id": "tune-up",
  "name": "Tune-Up",
  "context": "Personal",
  "tech": ["React Native", "Expo", "TypeScript"],
  "description": "Mobile App to understand training metrics easy",
  ...
}
```

Reescribir `description` con:

- Inglés correcto (adverbio, sujeto/verbo claros).
- Resultado o propuesta de valor: qué problema resuelve, para quién y qué hace distinto.

Ejemplo aceptable (ajustar si hay dato real):

```json
"description": "Personal React Native app that turns workout tracking into actionable weekly summaries: users see progress across sessions without manually comparing spreadsheets."
```

## Fuera de Alcance

- No tocar campos `links` ni `screenshot` de proyectos; eso es Task 10 y Task 11.
- No tocar HTML, componentes ni estilos.
- No generar imágenes ni assets.

## Verificación

- [ ] El JSON sigue siendo válido: `node -e "JSON.parse(require('fs').readFileSync('apps/web/public/data/experience.json','utf8'))"`.
- [ ] El JSON sigue siendo válido: `node -e "JSON.parse(require('fs').readFileSync('apps/web/public/data/projects.json','utf8'))"`.
- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] Al correr `pnpm preview` y visitar `/cv`, la Municipalidad de Tres de Febrero muestra un rango de fechas cerrado (no "Present").
- [ ] En `/`, la tarjeta Tune-Up muestra la nueva descripción.

## Handoff

- Produce: datos corregidos listos para ser consumidos por componentes y tests.
- Próximo task relacionado: Task 10 (extender modelo de datos de proyectos) y Task 11 (mostrar links/capturas), pero no dependen funcionalmente de este task.

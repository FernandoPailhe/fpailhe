# Task 10: Extender el modelo de datos de proyectos

> Parte del plan: `../plan.md` — leerlo para la definición completa de `Project` y `ProjectLink`.

## Skill / Capa

`add-feature` paso 1: tipos de dominio en `@ferpa/data-model`.

## Objetivo

Extender la entidad `Project` para soportar múltiples links públicos (App Store, Play Store, GitHub, sitio web) y una captura opcional, sin romper el campo `link` existente durante la transición.

## Depende De

— (ninguno; puede ejecutarse en paralelo con Tasks 01 y 07).

## Archivos a Crear/Editar

- `packages/data-model/src/types.ts` — editar
- `packages/data-model/src/index.ts` — verificar barrel export (no debería cambiar)
- `apps/web/public/data/projects.json` — editar (solo schema, links verificables y capturas)

## Detalles de Implementación

### 1. Tipos en `packages/data-model/src/types.ts`

Agregar la interfaz `ProjectLink` antes de `Project`:

```ts
export interface ProjectLink {
  type: "appStore" | "playStore" | "github" | "website";
  url: string;
  label?: string;
}
```

Extender `Project`:

```ts
export interface Project {
  id: string;
  name: string;
  context?: string;
  tech: string[];
  description: string;
  status: ProjectStatus;
  /** @deprecated use `links` instead. Kept for backward compatibility during migration. */
  link?: string;
  links?: ProjectLink[];
  /** Path to a screenshot under `/public/`, e.g. `/project-screenshots/tune-up.png`. */
  screenshot?: string;
  featured: boolean;
}
```

- `link` se marca como deprecated pero se conserva para no romper `ProjectCard` hasta que Task 11 migre la UI.
- `links` es opcional; si no existe, el componente sigue usando `link` o muestra el proyecto sin links.
- `screenshot` es opcional; si no existe, no se renderiza imagen.

### 2. `apps/web/public/data/projects.json`

Por cada proyecto, agregar solo links que se puedan verificar. Ejemplos razonables (revisar/confirmar con Fernando):

- `hang-app`: si es público, agregar `website`.
- `tune-up`: si tiene repositorio GitHub público, agregar `github`.
- Proyectos internos (`eqm`, `be-soul`, `el-puma-contigo`, `pass-app`): dejar `links` vacío o no agregar el campo, y documentar en Task 11 que faltan.

Ejemplo para un proyecto con links:

```json
{
  "id": "tune-up",
  "name": "Tune-Up",
  "context": "Personal",
  "tech": ["React Native", "Expo", "TypeScript"],
  "description": "...",
  "status": "in-progress",
  "links": [{ "type": "github", "url": "https://github.com/FernandoPailhe/tune-up" }],
  "featured": true
}
```

**No inventar URLs.** Si no se puede verificar un link, omitir el campo `links` para ese proyecto y documentarlo en Task 11 (`README` o comentario). Los assets de screenshot tampoco se generan acá; solo dejar el campo `screenshot` si el operador va a proveer la imagen.

### 3. Actualizar comentarios

Asegurar que el comentario de cabecera de `types.ts` diga `fpailhe.com` (si Task 02 ya lo cambió, no es necesario tocarlo).

## Fuera de Alcance

- No modificar `ProjectCard` ni `ProjectsSection` acá; es Task 11.
- No generar capturas de pantalla.
- No eliminar el campo `link` legacy todavía.

## Verificación

- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] El JSON `projects.json` parsea correctamente: `node -e "JSON.parse(require('fs').readFileSync('apps/web/public/data/projects.json','utf8'))"`.
- [ ] `Project` exportado desde `@ferpa/data-model` incluye `links?: ProjectLink[]` y `screenshot?: string`.

## Handoff

- Produce: entidad `Project` extendida y datos JSON listos para que Task 11 renderice links/capturas.

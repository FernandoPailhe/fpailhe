# Plan: fpailhe.com v0.2.0 — Release de correcciones críticas y calidad profesional

## Objetivo

Transformar el sitio personal de Fernando Pailhe de una SPA visualmente correcta pero frágil en un portfolio profesional, verificable y listo para compartir: metadatos completos, foto con fallback, datos corregidos, controles de calidad automatizados, tests, prerender, modo oscuro, accesibilidad mejorada, y un deploy en Cloudflare que devuelva 404 reales para assets inexistentes.

El plan cubre exactamente las dos etapas del alcance definidas en la auditoría. No incluye renames de scopes, cambios en `.devin/` ni reescrituras de arquitectura.

## Fuente de Requerimientos

- `/opt/data/workspace/marca-personal/AUDITORIA-fpailhe.com.md` (fuente de verdad del alcance, problemas y evidencias de línea).
- `.devin/rules/rules.md` y `.devin/rules/project-map.md` (arquitectura, data flow y convenciones del monorepo Ferpa).
- Skills del repo: `add-feature`, `add-query`, `add-route`, `add-ui-component`, `add-store`, `responsive-layout`, `theming`.

## Entidades

Las entidades principales ya existen en `packages/data-model/src/types.ts`. Este plan extiende `Project` para soportar múltiples links y captura opcional.

### `Project` (extendida)

| Campo         | Tipo                                        | Notas                                                                                                                                |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | `string`                                    | Identificador único.                                                                                                                 |
| `name`        | `string`                                    | Nombre del proyecto.                                                                                                                 |
| `context`     | `string` (opcional)                         | Cliente/empresa.                                                                                                                     |
| `tech`        | `string[]`                                  | Stack.                                                                                                                               |
| `description` | `string`                                    | Descripción con resultado medible.                                                                                                   |
| `status`      | `ProjectStatus` (`"live" \| "in-progress"`) | Estado.                                                                                                                              |
| `link`        | `string` (opcional)                         | **DEPRECATED** — conservar para compatibilidad con `ProjectCard` mientras se migra a `links`.                                        |
| `links`       | `ProjectLink[]` (opcional)                  | Lista de links públicos (App Store, Play Store, GitHub, web). Ver `ProjectLink`.                                                     |
| `screenshot`  | `string` (opcional)                         | Path de imagen relativo a `/public/` (ej. `/project-screenshots/tune-up.png`). Debe existir en `apps/web/public/` para renderizarse. |
| `featured`    | `boolean`                                   | Aparece en Home.                                                                                                                     |

### `ProjectLink` (nueva)

| Campo   | Tipo                                                 | Notas                                                                    |
| ------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `type`  | `"appStore" \| "playStore" \| "github" \| "website"` | Tipo de destino.                                                         |
| `url`   | `string`                                             | URL pública verificada. Solo incluir si se puede verificar.              |
| `label` | `string` (opcional)                                  | Texto alternativo; si no se provee, el componente usa el label por tipo. |

### `AboutAside` (sin cambios de schema)

| Campo   | Tipo     | Notas                                                                                                                                                               |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`  | `string` | Texto del aside.                                                                                                                                                    |
| `photo` | `string` | Path relativo a `/public/` (actualmente `fernando-photo.jpg`). El archivo es responsabilidad del operador; el componente debe mostrar un fallback si falta o falla. |

### `Job` (sin cambios de schema)

| Campo        | Tipo                  | Notas                                                                         |
| ------------ | --------------------- | ----------------------------------------------------------------------------- |
| `id`         | `string`              | Identificador único.                                                          |
| `title`      | `string`              | Rol.                                                                          |
| `company`    | `string`              | Empresa.                                                                      |
| `location`   | `string` (opcional)   | Ubicación.                                                                    |
| `startDate`  | `string` (`YYYY-MM`)  | Inicio.                                                                       |
| `endDate`    | `string \| null`      | Fin; `null` significa "Present". Debe revisarse que no haya errores de datos. |
| `bullets`    | `string[]`            | Logros.                                                                       |
| `tech`       | `string[]`            | Stack.                                                                        |
| `projectIds` | `string[]` (opcional) | Proyectos relacionados.                                                       |

### `Profile`, `Hero`, `Stat`, `HowIWork`, `ContactSection`, `EducationEntry`, `CourseEntry`

Sin cambios. Ver `packages/data-model/src/types.ts` para sus shapes.

Archivo destino de tipos: `packages/data-model/src/types.ts`.  
Funciones de dominio puras: `packages/data-model/src/domain.ts`.  
Formatters: `packages/data-model/src/format.ts`.

## Fuente de Datos

| Recurso                                       | Tipo                                     | Path / Endpoint                     | Shape                             |
| --------------------------------------------- | ---------------------------------------- | ----------------------------------- | --------------------------------- |
| Todos los datos de contenido                  | JSON estático                            | `apps/web/public/data/*.json`       | Interfaces de `@ferpa/data-model` |
| `about-aside.json`                            | JSON estático                            | `/data/about-aside.json`            | `AboutAside`                      |
| `experience.json`                             | JSON estático                            | `/data/experience.json`             | `Job[]`                           |
| `projects.json`                               | JSON estático                            | `/data/projects.json`               | `Project[]`                       |
| `profile.json`                                | JSON estático                            | `/data/profile.json`                | `Profile`                         |
| Assets visuales (foto, OG, favicon, capturas) | Archivos estáticos en `apps/web/public/` | Paths referenciados desde JSON/HTML | JPG/PNG/SVG/ICO                   |

Los assets visuales son provistos por el operador; este plan solo referencia sus paths. No se generan imágenes.

## Lógica Derivada

- Ordenamiento cronológico de experiencia: ya existe en `packages/data-model/src/domain.ts` (`sortJobsByDateDesc`). No cambia.
- Filtrado de proyectos destacados: ya existe (`getFeaturedProjects`). No cambia.
- Resolución de proyectos por `job.projectIds`: ya existe (`getJobProjects`). No cambia.
- Formateo de fechas: ya existe (`formatDateRange`, `formatMonthYear`). No cambia.
- Nuevos helpers de dominio puro para projects (opcional): si se prefiere, una función `getProjectPrimaryLink(project)` puede devolver el primer link disponible, pero no es obligatoria; se puede manejar en presentación con `links[0]` y guardas por `noUncheckedIndexedAccess`.

## Componentes / Pantallas

| Componente           | Nivel            | Ubicación                                   | Cambio                                                                                                                             |
| -------------------- | ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `InitialsAvatar`     | Atom             | `packages/ui/src/atoms/InitialsAvatar.tsx`  | Nuevo. Fallback visual genérico con iniciales.                                                                                     |
| `ProjectCard`        | Molecule         | `packages/ui/src/molecules/ProjectCard.tsx` | Modificar: aceptar `links` y `screenshot` opcionales, mostrar links con iconos/labels genéricos, sin romper prop `link` existente. |
| `AboutSection`       | Organismo        | `apps/web/src/components/AboutSection.tsx`  | Modificar: usar `InitialsAvatar` como fallback si `photo` falta o falla.                                                           |
| `Nav`                | Organismo        | `apps/web/src/components/Nav.tsx`           | Modificar: agregar `aria-label`, skip-link al contenido.                                                                           |
| `Dialog`             | Molecule         | `packages/ui/src/molecules/Dialog.tsx`      | Revisar foco, overlay click, devolución de foco.                                                                                   |
| `ThemeProvider`      | Theme            | `packages/ui/src/theme/ThemeProvider.tsx`   | Modificar: soportar tokens de tema oscuro y persistir preferencia del usuario.                                                     |
| `globals.css`        | Estilos globales | `apps/web/src/styles/globals.css`           | Modificar: `color-scheme: light dark`, media query `prefers-color-scheme`, mantener print intacto.                                 |
| `index.html`         | HTML entry       | `apps/web/index.html`                       | Modificar: lang, title, description, canonical, OG, Twitter, favicon, theme-color.                                                 |
| `App.tsx`            | Rutas            | `apps/web/src/App.tsx`                      | Sin cambios de ruta (sigue `/` y `/cv`).                                                                                           |
| `HomePage`, `CVPage` | Routes           | `apps/web/src/routes/`                      | Sin cambios de estructura; consumen datos actualizados.                                                                            |

## Secuencia de Implementación

| #   | Task file                                                       | Capa / Skill                                       | Depende de | Etapa |
| --- | --------------------------------------------------------------- | -------------------------------------------------- | ---------- | ----- |
| 1   | `tasks/01-corregir-datos-de-contenido.md`                       | Edición de datos JSON                              | —          | 1     |
| 2   | `tasks/02-corregir-metadatos-base-en-index-html.md`             | HTML estático                                      | —          | 1     |
| 3   | `tasks/03-implementar-fallback-de-foto.md`                      | `add-ui-component` (atom) + organismo              | —          | 1     |
| 4   | `tasks/04-agregar-open-graph-y-twitter-cards.md`                | HTML estático                                      | 2          | 1     |
| 5   | `tasks/05-agregar-favicon-e-iconos.md`                          | HTML estático + assets                             | 2          | 1     |
| 6   | `tasks/06-agregar-robots-txt-y-sitemap-xml.md`                  | Archivos estáticos + deploy                        | 2          | 1     |
| 7   | `tasks/07-configurar-eslint-prettier-editorconfig-y-scripts.md` | Infra / tooling                                    | —          | 2     |
| 8   | `tasks/08-configurar-github-actions-workflow.md`                | CI/CD                                              | 7          | 2     |
| 9   | `tasks/09-configurar-vitest-testing-library-y-tests-base.md`    | Tests                                              | 7          | 2     |
| 10  | `tasks/10-extender-modelo-de-datos-de-proyectos.md`             | `add-feature` (paso 1)                             | —          | 2     |
| 11  | `tasks/11-mostrar-links-y-capturas-en-proyectos.md`             | `add-ui-component` (molecule) + `add-feature` (UI) | 1, 10      | 2     |
| 12  | `tasks/12-implementar-dark-mode.md`                             | `theming`                                          | —          | 2     |
| 13  | `tasks/13-mejorar-accesibilidad-skip-link-aria-focus-dialog.md` | `add-ui-component` / a11y                          | —          | 2     |
| 14  | `tasks/14-implementar-prerender-de-rutas.md`                    | Build / SSR manual                                 | 7, 9       | 2     |
| 15  | `tasks/15-ajustar-infraestructura-cloudflare-y-headers.md`      | Deploy / wrangler.toml                             | 6, 14      | 2     |
| 16  | `tasks/16-limpiar-residuos-del-template-y-actualizar-readme.md` | Limpieza                                           | 7          | 2     |
| 17  | `tasks/17-verificacion-final-integracion.md`                    | Verificación                                       | all        | 2     |

Notas de paralelismo:

- Dentro de la Etapa 1, los tasks 1, 2 y 3 son independientes y pueden ejecutarse en paralelo. El task 4 depende del 2 (para no pisar metadatos base). El 5 y 6 también dependen del 2 pero son independientes entre sí.
- Dentro de la Etapa 2, los tasks 7, 10, 12, 13 son independientes entre sí y pueden arrancar en paralelo. Los tasks 8, 9 dependen del 7. El 11 depende del 1 y 10. El 14 depende del 7 y 9. El 15 depende del 6 y 14. El 16 depende del 7 (porque limpiar mensajes en español puede chocar con lint de no-ascii? No, pero preferible tener lint configurado antes). El 17 es siempre al final.

## Criterios de Aceptación Globales

- [ ] Todos los tipos de dominio viven una sola vez en `@ferpa/data-model`. `Project` incluye `links` y `screenshot` opcionales.
- [ ] `packages/ui` no importa `@ferpa/data-model`; los componentes genéricos reciben props primitivas (strings, arrays de links genéricos).
- [ ] Fetchers siguen en `services/dataService.ts`; no se agregan llamadas a `fetch` en componentes.
- [ ] Todos los mensajes de error/estado de la UI están en inglés (el sitio es íntegramente en inglés).
- [ ] `index.html` tiene `<html lang="en">`, title, description correcta, canonical, OG completo, Twitter Cards, favicon, theme-color.
- [ ] `robots.txt` y `sitemap.xml` existen en `apps/web/public/` y el sitemap lista `/` y `/cv` con `https://fpailhe.com`.
- [ ] `apps/web/public/` contiene placeholders/documentación para assets que debe proveer el operador: foto, OG image, favicon set, capturas de proyectos.
- [ ] El build genera HTML prerenderizado para `/` y `/cv` con contenido real visible sin JavaScript.
- [ ] El deploy Cloudflare devuelve 404 reales para archivos estáticos inexistentes y mantiene SPA fallback solo para rutas sin extensión.
- [ ] Headers de seguridad configurados en Cloudflare/wrangler.toml: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- [ ] Dark mode responde a `prefers-color-scheme`, tiene toggle persistente y no rompe estilos de impresión.
- [ ] Accesibilidad: skip-link, `aria-label` en navegación, foco visible, dialog accesible, contraste verificado contra tokens.
- [ ] `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm typecheck` y `pnpm build` pasan sin errores en CI y local.
- [ ] Named exports en todo el código nuevo; nunca `export default`.
- [ ] Sin hex/font hardcodeados fuera de `packages/ui/src/theme/tokens.ts`.

## Preguntas Abiertas / Supuestos

- Los assets de imagen (foto de perfil, OG 1200×630, favicon set, capturas de proyectos) son provistos por el operador. El plan solo define sus paths esperados y documenta dónde colocarlos.
- Los links públicos verificables de cada proyecto (App Store, Play Store, GitHub, sitio web) dependen del dueño. El plan indica documentar los que falten para que los complete; no se inventan URLs.
- La fecha de fin real del trabajo en la Municipalidad de Tres de Febrero no fue provista en la auditoría. **Decisión del executor (v0.2.0): se mantiene `endDate: null`** porque la fuente original lo lista como trabajo en curso; no se inventó una fecha "razonable". Queda documentado con un campo `_note` en `apps/web/public/data/experience.json`, pendiente de confirmación del dueño.
- El mecanismo de prerender elegido es un script propio de build con `react-dom/server` + `StaticRouter` para evitar agregar frameworks que rompan la estructura actual. Si el executor encuentra una barrera insalvable, debe consultar antes de cambiar a Vike/Astro/Next.
- El redirect de `www.fpailhe.com` a `fpailhe.com` se configura en Cloudflare (DNS / Page Rules), no en código; se documenta en el task de infraestructura.

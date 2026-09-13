# Task 14: Implementar prerender de rutas / y /cv

> Parte del plan: `../plan.md` — leerlo para contexto de deploy, HTML y estructura de rutas.

## Skill / Capa

Build tooling + HTML estático. No se agrega un framework; se usa un script post-build que inyecta contenido semántico en `dist/index.html` y `dist/cv/index.html`.

## Objetivo

Generar HTML estático con contenido real (H1, secciones, texto) para `/` y `/cv` de modo que, sin JavaScript, los crawlers y lectores de pantalla vean contenido. Mantener el funcionamiento de la SPA y del deploy en Cloudflare.

## Depende De

- Task 07: script `build` debe poder extenderse en `apps/web/package.json`.
- Task 09: los datos JSON deben ser válidos; los tests ya validan dominio.
- Task 01, Task 10: datos corregidos/extendidos deben estar en su forma final.

## Archivos a Crear/Editar

- `apps/web/scripts/prerender.mjs` — crear
- `apps/web/package.json` — editar script `build`
- `apps/web/src/styles/globals.css` — editar si se necesitan clases de utilidad para el HTML estático (opcional)

## Detalles de Implementación

### 1. Mecanismo elegido: script post-build de prerender estático

**Justificación**: el sitio usa React Router + TanStack Query. Agregar un framework SSR/SSG (Vike, Astro, Next.js) rompería la estructura actual y aumentaría el scope. Un script post-build genera HTML semántico a partir de los mismos JSON que consume la app, inyecta el contenido en el `<div id="root">` y deja el bundle JS intacto para hidratación. Cloudflare sigue sirviendo los mismos assets estáticos.

### 2. Script `apps/web/scripts/prerender.mjs`

El script:

1. Lee `dist/index.html` como plantilla.
2. Lee los archivos JSON de `apps/web/public/data/*.json` con `fs.readFileSync` + `JSON.parse`.
3. Genera dos cadenas de HTML semántico: una para `/` (Home) y otra para `/cv`.
4. Reemplaza `<div id="root"></div>` por el HTML generado + `<div id="root"></div>` o directamente reemplaza el div.
5. Escribe:
   - `dist/index.html` (para `/`)
   - `dist/cv/index.html` (para `/cv`; crear carpeta `dist/cv` si no existe)

Contenido mínimo a generar (reusar clases Tailwind de los componentes React correspondientes para minimizar flash de hidratación):

#### Home (`/`)

- `<main id="main-content">` (o el tag que use el skip-link)
- `<h1>` con `profile.name` / `profile.role` o mejor con `hero.headlineLead + hero.headlineEmphasis`
- `<p>` con `hero.subhead`
- Stats: lista `<ul>` con `stats[].value`, `label`, `sublabel`
- How I Work: paneles con títulos y cuerpo
- About: texto + imagen o monograma (ver Task 03). Para el prerender, si `fernando-photo.jpg` no existe en `dist`, mostrar el monograma estático `<span class="...">FP</span>`.
- Projects: lista de proyectos destacados con nombre, descripción, estado, tech stack y links (usar `links` o `link`).
- Contact: heading, body, email.

#### CV (`/cv`)

- `<main id="main-content">`
- Header CV: `<h1>profile.name</h1>`, role, location, email, LinkedIn, GitHub, domain.
- Experience: ordenada cronológicamente (usar `sortJobsByDateDesc`? El script es JS, puede importar la función de `packages/data-model/dist` pero no es necesario: ordenar manualmente por `endDate ?? '9999-12'` desc).
- Education y Courses.

Recomendación: importar las funciones puras de `@ferpa/data-model` solo si el paquete ya está compilado en `dist`; como el build de web depende de que data-model se haya buildeado, se puede hacer `import { sortJobsByDateDesc, formatDateRange, getFeaturedProjects } from '../../packages/data-model/dist/index.js'`. **Alternativa más simple**: duplicar la lógica de ordenamiento/formateo en el script (es pequeña y evita dependencias de build). Elige la opción más simple para el executor; el criterio es que el HTML estático refleje el contenido real.

#### Ejemplo de estructura del script

```js
// apps/web/scripts/prerender.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const dataDir = path.resolve(__dirname, "../public/data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), "utf8"));
}

function renderHome({ profile, hero, stats, howIWork, aboutAside, projects }) {
  // retorna HTML string semántico
}

function renderCV({ profile, experience, education, courses, projects }) {
  // retorna HTML string semántico
}

const template = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
const data = {
  profile: readJson("profile"),
  hero: readJson("hero"),
  stats: readJson("stats"),
  howIWork: readJson("how-i-work"),
  aboutAside: readJson("about-aside"),
  projects: readJson("projects"),
  experience: readJson("experience"),
  education: readJson("education"),
  courses: readJson("courses"),
};

function writePage(route, html) {
  const outDir = route === "/" ? distDir : path.join(distDir, route.replace(/^\//, ""));
  fs.mkdirSync(outDir, { recursive: true });
  const output = template.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  fs.writeFileSync(path.join(outDir, "index.html"), output, "utf8");
}

writePage("/", renderHome(data));
writePage("/cv", renderCV(data));
console.log("Prerendered / and /cv");
```

### 3. Modificar `apps/web/package.json`

Cambiar:

```json
"build": "tsc --noEmit && vite build && node scripts/prerender.mjs"
```

### 4. Requisitos del HTML generado

- Debe contener exactamente un `<h1>` por ruta (Home: headline; CV: nombre).
- Debe incluir textos reales de los JSON; no texto genérico.
- Debe conservar los `<script type="module" src="/src/main.tsx"></script>` para que React hidrate.
- No es necesario que sea visualmente idéntico a la SPA, sí semánticamente equivalente.

## Fuera de Alcance

- No migrar a Astro, Next.js ni Vike.
- No generar rutas dinámicas; solo `/` y `/cv`.
- No modificar la arquitectura de queries/componentes.

## Verificación

- [ ] `pnpm build` pasa y el script `prerender.mjs` se ejecuta sin errores.
- [ ] `dist/index.html` contiene contenido textual real (no solo `<div id="root"></div>`).
- [ ] `dist/cv/index.html` existe y contiene contenido textual real.
- [ ] Al servir `dist` con un servidor estático (p. ej. `npx serve dist`), `/` y `/cv` muestran el contenido incluso con JavaScript deshabilitado.
- [ ] Con JavaScript habilitado, la SPA sigue funcionando: navegación interna entre `/` y `/cv` sin recarga completa.
- [ ] `pnpm test` y `pnpm lint` pasan.

## Handoff

- Produce: build que genera HTML estático prerenderizado para `/` y `/cv`, listo para deploy Cloudflare.
- Próximo task: Task 15 ajusta el fallback 404 de Cloudflare para que los archivos estáticos inexistentes devuelvan 404 reales.

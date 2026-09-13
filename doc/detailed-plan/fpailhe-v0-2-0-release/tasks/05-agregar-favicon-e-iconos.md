# Task 05: Agregar favicon e iconos

> Parte del plan: `../plan.md` — leerlo para contexto de metadatos y assets.

## Skill / Capa

Edición de `apps/web/index.html` y documentación de assets en `apps/web/public/`.

## Objetivo

Agregar los `<link>` correctos para favicon e íconos, y `meta theme-color`. Los archivos de imagen los provee el operador; este task solo los referencia y documenta.

## Depende De

- Task 02: para no pisar el `<head>` base; se añaden tags junto con los metadatos y OG.

## Archivos a Crear/Editar

- `apps/web/index.html` — editar
- `apps/web/public/assets/README.md` — crear (documentación de assets esperados)

## Detalles de Implementación

### 1. `apps/web/index.html`

Agregar dentro de `<head>`, preferentemente justo antes de los `preconnect` o junto a los metadatos base:

```html
<!-- Icons and theme color -->
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#C1502E" />
```

- `theme-color` debe coincidir con el acento terracota definido en `packages/ui/src/theme/tokens.ts` (`color.gold = #C1502E`).
- Los paths son absolutos (`/favicon.ico`, etc.) y se sirven desde `apps/web/public/`.

### 2. Documentación de assets

Crear `apps/web/public/assets/README.md` con el siguiente contenido mínimo:

```markdown
# Assets esperados

Colocar en esta carpeta los archivos de imagen referenciados por el sitio:

- `../favicon.ico` — favicon multi-resolución.
- `../favicon-32.png` — favicon PNG 32×32.
- `../apple-touch-icon.png` — ícono para iOS (180×180 recomendado).
- `../og-image.png` — imagen Open Graph / Twitter Card (1200×630).
- `../fernando-photo.jpg` — foto del About (reemplaza el fallback de monograma).
- `project-screenshots/*.png` — capturas opcionales de proyectos (ver `projects.json`).

No borrar este README; sirve como checklist para deploy.
```

Nota: si se prefiere mantener los assets en `public/` directamente, el README puede ir en `public/README-assets.md`; la ruta exacta es menos importante que documentar el conjunto.

## Fuera de Alcance

- No generar los archivos de imagen.
- No modificar estilos CSS.
- No modificar Open Graph (Task 04).

## Verificación

- [ ] `pnpm build` pasa.
- [ ] En `dist/index.html` se ven los tres `<link rel="icon">` / `apple-touch-icon` y `<meta name="theme-color" content="#C1502E" />`.
- [ ] Al colocar `favicon.ico`, `favicon-32.png` y `apple-touch-icon.png` en `apps/web/public/`, el navegador los carga sin 404.
- [ ] El README de assets existe y lista todos los assets esperados.

## Handoff

- Produce: `index.html` con favicon/links/theme-color y documentación para el operador.
- Próximo task: Task 15 (infra Cloudflare) se asegura de que assets faltantes devuelvan 404 reales.

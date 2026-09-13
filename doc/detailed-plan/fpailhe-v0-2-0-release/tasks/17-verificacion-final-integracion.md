# Task 17: Verificación final de integración

> Parte del plan: `../plan.md` — leerlo para contexto de criterios de aceptación globales.

## Skill / Capa

Verificación end-to-end: build, typecheck, lint, tests, inspección de artifacts y pruebas manuales mínimas.

## Objetivo

Confirmar que todos los cambios de las Etapas 1 y 2 se integran correctamente y que el sitio cumple los criterios de aceptación globales.

## Depende De

Todos los tasks anteriores (1–16). Debe ejecutarse al final.

## Archivos a Inspeccionar

- `dist/index.html`
- `dist/cv/index.html`
- `dist/robots.txt`
- `dist/sitemap.xml`
- `dist/_headers` (si aplica)
- `dist/404.html`
- `.github/workflows/ci.yml`

## Detalles de Implementación

No se crea código nuevo. Se ejecutan comandos y se inspeccionan resultados.

### 1. Comandos de calidad

Ejecutar en orden:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Todos deben pasar sin errores.

### 2. Inspección del build

Verificar que existen en `dist/`:

- `index.html` con:
  - `<html lang="en">`
  - `<title>` correcto
  - `<meta name="description">` con `fpailhe.com` y sin `fpailhe.dev`
  - `<link rel="canonical" href="https://fpailhe.com/" />`
  - tags Open Graph completos
  - tags Twitter Card
  - favicon / apple-touch-icon links
  - `<meta name="theme-color" content="#C1502E">`
  - contenido real en `<div id="root">` (prerender)
- `cv/index.html` con contenido real y `<h1>` con el nombre.
- `robots.txt` y `sitemap.xml` con rutas correctas.
- `_headers` con headers de seguridad (si aplica).
- `404.html`.
- No hay referencias a `fpailhe.dev`.
- No hay strings en español en la UI (`grep -R "No se\|Cargando\|No se pudo\|La página que buscás" dist/index.html dist/cv/index.html` vacío).

### 3. Pruebas manuales mínimas

Ejecutar:

```bash
pnpm preview
```

O con un servidor estático sobre `dist`:

```bash
npx serve dist
```

Verificar:

- [ ] `/` carga y muestra el contenido.
- [ ] `/cv` carga y muestra el contenido.
- [ ] Navegación interna entre Home y CV funciona como SPA.
- [ ] La foto del About muestra el monograma fallback (a menos que el operador haya subido la foto).
- [ ] El toggle de dark mode cambia colores y persiste tras recargar.
- [ ] El skip-link es visible al navegar con Tab.
- [ ] `window.print()` en `/cv` mantiene fondo claro y texto oscuro.

### 4. 404 real para assets inexistentes

En el preview/deploy:

```bash
curl -I http://localhost:4173/no-existe.png
```

Debe devolver `404 Not Found` (no `200` con HTML de SPA).

Las rutas `/` y `/cv` deben devolver `200` con el HTML correcto.

### 5. CI

- Hacer commit de todos los cambios.
- Pushear a `main` (o a un PR).
- Verificar que el workflow `CI` de GitHub Actions se dispare y pase.

## Fuera de Alcance

- No agregar nuevas funcionalidades.
- No modificar código solo para corregir warnings menores que no rompen el build.

## Verificación

- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm lint` pasa.
- [ ] `pnpm format:check` pasa.
- [ ] `pnpm test` pasa.
- [ ] `pnpm build` pasa.
- [ ] El workflow de GitHub Actions es verde.
- [ ] `dist/index.html` y `dist/cv/index.html` contienen contenido real.
- [ ] Assets inexistentes devuelven 404.

## Handoff

- Produce: release v0.2.0 lista para deploy en Cloudflare.
- Entregables finales: repo limpio, tests verdes, build funcional, documentación actualizada.

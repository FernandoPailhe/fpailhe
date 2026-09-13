# Task 06: Agregar robots.txt y sitemap.xml

> Parte del plan: `../plan.md` — leerlo para contexto de rutas reales y deploy.

## Skill / Capa

Archivos estáticos en `apps/web/public/` y configuración de deploy (parcial; el ajuste final de fallback 404 es Task 15).

## Objetivo

Crear `robots.txt` y `sitemap.xml` reales en `apps/web/public/` que reflejen las rutas existentes del sitio (`/` y `/cv`).

## Depende De

- Task 02: para asegurar que el dominio canónico es `fpailhe.com`.

## Archivos a Crear/Editar

- `apps/web/public/robots.txt` — crear
- `apps/web/public/sitemap.xml` — crear

## Detalles de Implementación

### `apps/web/public/robots.txt`

```txt
User-agent: *
Allow: /

Sitemap: https://fpailhe.com/sitemap.xml
```

### `apps/web/public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://fpailhe.com/</loc>
    <lastmod>2026-09-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://fpailhe.com/cv</loc>
    <lastmod>2026-09-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

- Ajustar `<lastmod>` a la fecha real de deploy si difiere.
- Si se agregan rutas futuras en `App.tsx`, se debe actualizar este sitemap.

## Fuera de Alcance

- No ajustar aún `not_found_handling` ni headers de seguridad; eso es Task 15.
- No generar HTML estático (Task 14).

## Verificación

- [ ] `pnpm build` pasa.
- [ ] Existen `dist/robots.txt` y `dist/sitemap.xml` con el contenido esperado.
- [ ] Al visitar `http://localhost:5173/robots.txt` y `http://localhost:5173/sitemap.xml` en dev, se sirven correctamente (Vite sirve `public/` directamente).
- [ ] El sitemap valida contra `https://www.sitemaps.org/schemas/sitemap/0.9` (ej. usando un validador online).

## Handoff

- Produce: archivos estáticos listos para deploy.
- Próximo task: Task 15 ajusta el fallback 404 para que archivos inexistentes devuelvan 404 reales en lugar del HTML de SPA.

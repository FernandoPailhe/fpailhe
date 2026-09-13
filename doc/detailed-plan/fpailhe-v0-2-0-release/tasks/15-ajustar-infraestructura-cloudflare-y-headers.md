# Task 15: Ajustar infraestructura Cloudflare y headers de seguridad

> Parte del plan: `../plan.md` — leerlo para contexto de deploy, assets y rutas.

## Skill / Capa

Deploy e infraestructura: `wrangler.toml`, archivos `_headers`, `_routes.json` y `404.html`.

## Objetivo

1. Devolver 404 reales para assets estáticos inexistentes sin romper las rutas de la SPA.
2. Agregar headers de seguridad (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
3. Actualizar `wrangler.toml` (quitar comentarios de template, mantener `name = "ferpa"`).

## Depende De

- Task 06: `robots.txt` y `sitemap.xml` ya existen; este task configura el servidor para servirlos correctamente.
- Task 14: `/` y `/cv` ya existen como archivos HTML estáticos reales (`dist/index.html` y `dist/cv/index.html`), lo que permite usar `not_found_handling = "404-page"` sin perder la navegación.

## Archivos a Crear/Editar

- `wrangler.toml` — editar
- `apps/web/public/_headers` — crear
- `apps/web/public/404.html` — crear
- `apps/web/public/_routes.json` — crear (opcional, para control de SPA fallback)

## Detalles de Implementación

### 1. `wrangler.toml`

Actual:

```toml
name = "ferpa"
compatibility_date = "2026-09-01"

# TEMPLATE: Descomentar y configurar para deploy a Cloudflare Workers.
# workers_dev = false
#
# [[routes]]
# pattern = "tu-dominio.com"
# custom_domain = true

[assets]
directory = "apps/web/dist"
not_found_handling = "single-page-application"
```

Reemplazar por:

```toml
name = "ferpa"
compatibility_date = "2026-09-01"

[assets]
directory = "apps/web/dist"
not_found_handling = "404-page"
```

- Se mantiene `name = "ferpa"`.
- Se quita el bloque comentado de template.
- Se cambia `not_found_handling` de `"single-page-application"` a `"404-page"`. Esto hace que las URLs con extensión (`.png`, `.jpg`, `.pdf`, etc.) que no existan devuelvan 404 real en lugar de index.html.
- Las rutas `/` y `/cv` siguen funcionando porque serán archivos reales en `dist` tras el prerender (Task 14).

### 2. `apps/web/public/404.html`

Crear una página 404 simple en inglés:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page not found — Fernando Pailhe</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        max-width: 600px;
        margin: 80px auto;
        padding: 0 24px;
        color: #111;
      }
      a {
        color: #c1502e;
      }
    </style>
  </head>
  <body>
    <h1>404 — Page not found</h1>
    <p>The page you are looking for does not exist.</p>
    <p><a href="/">Back to home</a></p>
  </body>
</html>
```

### 3. `apps/web/public/_headers`

```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.jpg
  Cache-Control: public, max-age=31536000, immutable

/*.ico
  Cache-Control: public, max-age=31536000, immutable
```

Notas:

- HSTS requiere que el dominio ya sirva HTTPS. Cloudflare lo fuerza por defecto si está proxyado; si no, el header se envía igual.
- El caché largo aplica a assets con hash? Vite genera assets hasheados, pero las imágenes en `public/` no tienen hash. Ajustar según política; lo importante es que estén presentes los headers de seguridad.
- Si Cloudflare Workers Assets no aplica `_headers` directamente (es un feature de Cloudflare Pages), verificar plataforma. Si el deploy es Workers with Assets, `_headers` no funciona; los headers deben agregarse vía Worker. Como el repo usa `wrangler.toml` con `[assets]`, asumimos Cloudflare Pages / Workers Assets que sí soportan `_headers` y `_redirects`. Si no es así, documentar la alternativa en el task handoff.

### 4. `apps/web/public/_routes.json` (opcional)

Si se usa Cloudflare Pages, `_routes.json` controla qué requests son procesados por el SPA:

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/robots.txt",
    "/sitemap.xml",
    "/_headers",
    "/_redirects",
    "/assets/*",
    "/project-screenshots/*"
  ]
}
```

Si el deploy es Workers, este archivo no tiene efecto; no crearlo en ese caso.

## Fuera de Alcance

- No configurar el redirect de `www.fpailhe.com` a `fpailhe.com`; eso se hace en Cloudflare DNS / Page Rules / Redirect Rules. Documentar en README o comentario.
- No cambiar el `name` del worker de `"ferpa"`.
- No generar certificados ni DNS.

## Verificación

- [ ] `pnpm build` pasa y `dist/_headers`, `dist/404.html` existen.
- [ ] Al correr `wrangler dev` o deployar, `https://fpailhe.com/robots.txt` devuelve el texto correcto.
- [ ] Una URL como `https://fpailhe.com/no-existe.png` devuelve 404 (no HTML de SPA).
- [ ] Las rutas `/` y `/cv` siguen sirviendo el contenido correcto.
- [ ] Los headers de seguridad aparecen en la respuesta de una URL cualquiera (verificar con curl: `curl -I https://fpailhe.com/`).
- [ ] No hay comentarios "TEMPLATE" restantes en `wrangler.toml`.

## Handoff

- Produce: configuración de deploy actualizada para devolver 404 reales, headers de seguridad y página 404 estática.
- Próximo task: Task 17 verifica todo el build y deploy local/preview.

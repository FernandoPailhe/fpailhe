# Assets esperados

Colocar en `apps/web/public/` los archivos de imagen referenciados por el sitio:

- `../favicon.ico` — favicon multi-resolución (16/32/48). ✅ provisto.
- `../favicon-32.png` — favicon PNG 32×32. ✅ provisto.
- `../apple-touch-icon.png` — ícono para iOS (180×180 recomendado). ✅ provisto.
- `../og-image.png` — imagen Open Graph / Twitter Card (1200×630). ✅ provisto.
- `../fernando-photo.jpg` — foto del About (640×640 provista; si falta, el sitio muestra el fallback de monograma "FP").
- `../project-screenshots/<id>.png` — capturas opcionales de proyectos, una por proyecto que tenga `"screenshot"` en `apps/web/public/data/projects.json`. ❌ pendientes: ninguna fue provista todavía; los proyectos no declaran `screenshot` hasta que existan los archivos.

No borrar este README; sirve como checklist para deploy.

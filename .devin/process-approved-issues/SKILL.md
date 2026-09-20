---
name: process-approved-issues
description: Procesa los issues de GitHub con etiqueta agent-approved por lotes (publish primero), los implementa en orden, genera releases y publica a main cuando corresponde
argument-hint: "[owner/repo]"
---

# Procesar issues aprobados por el agente

Pipeline iterativo sobre los issues de GitHub etiquetados `agent-approved`: se trabaja por lotes (primero los que además tienen `publish`), con implementación incremental, una release por lote y publicación a `main` cuando corresponde. Tras publicar, el proceso se reinicia con los issues restantes.

## 0. Setup

1. Determina el repositorio objetivo:
   - Si el usuario pasó `owner/repo` como argumento, úsalo.
   - Si no, resuélvelo desde el remote de git del proyecto actual (`git remote get-url origin` o `gh repo view --json nameWithOwner`).
2. Descubre las herramientas disponibles del servidor MCP `github` con `mcp_list_tools` antes de llamarlas — no asumas nombres de herramientas.
3. Verifica que hay un remote configurado y credenciales de git funcionando (un `git fetch` inicial sirve de chequeo).
4. Asegura que `.devin/agent-work/` está en `.git/info/exclude` — los archivos de trabajo de este proceso (prioridades, planes) **nunca** quedan trackeados ni se commitean. No modifiques el `.gitignore` trackeado.

## Loop principal (repetir hasta que no queden issues)

Cada iteración procesa **un solo lote**. Tras un lote publicado, vuelve al paso 1 y re-consulta GitHub.

### 1. Obtener el lote

1. Lista los issues **abiertos** con la etiqueta `agent-approved` usando el MCP de GitHub.
2. Excluye los issues ya completados en esta ejecución (los registrados como completados en `.devin/agent-work/priorities.md`) y los que tengan la etiqueta `status:blocked` (requieren intervención humana — anótalos en el reporte).
3. Issues que tienen `publish` pero **no** `agent-approved`: nunca se implementan. Anótalos como omitidos en el reporte.
4. Determina el lote actual:
   - Si existe al menos un issue con `agent-approved` + `publish` → el lote son **solo** esos issues (lote *publish*).
   - Si ninguno tiene `publish` → el lote son todos los `agent-approved` restantes (lote *final*: se hace release pero no se publica a `main`).
5. Si no quedan issues por procesar, ve al reporte final.

### 2. Priorizar el lote

1. Orden de implementación:
   - Si los issues tienen etiquetas de prioridad (`priority:*`, `P0`–`P3`, etc.), ordénalos por prioridad.
   - Los issues sin etiqueta de prioridad ordénalos según el orden óptimo que determines (dependencias entre issues, tamaño, riesgo). Issues con dependencias van después de sus dependencias.
2. Crea/actualiza `.devin/agent-work/priorities.md` con la lista ordenada del lote (número, título, etiquetas, razón del orden) y el estado de cada issue (pendiente / en progreso / completado). Mantén el historial de lotes anteriores en el mismo archivo.

### 3. Crear la rama de trabajo

1. Determina la base:
   - Si existen ramas remotas `release/*`, usa la de mayor versión semver.
   - Si no hay ramas release, usa el tag semver más reciente (`v*` o `X.Y.Z`).
   - Si no hay ninguno, usa la rama por defecto (`main` o la que corresponda).
2. Crea la rama `agent/approved-issues-YYYYMMDD` (agrega `-2`, `-3`, etc. si ya existe por lotes previos del mismo día) desde esa base y pusheala.

### 4. Implementar cada issue (en orden)

Para cada issue del lote:

1. Al empezar a trabajar el issue, agrégale la etiqueta `status:in-progress` vía MCP de GitHub — bloquea el issue para que nadie más lo tome.
2. Si el proyecto tiene la skill `make-detailed-plan` disponible (verifícalo con la herramienta `skill` en modo list/search sobre el path del proyecto), invócala para generar el plan de implementación del issue.
   - Los archivos del plan deben quedar dentro de `.devin/agent-work/` o rutas agregadas a `.git/info/exclude` — nunca trackeados.
   - Si la skill no existe, planifica directamente a partir del contenido del issue.
3. Implementa el plan siguiendo las convenciones del proyecto.
4. Verifica la implementación con **todas** las herramientas que el proyecto tenga disponibles — descúbrelas en `AGENTS.md`, `package.json` (scripts `test`, `lint`, `typecheck`, `build`), `Makefile`, configuración de CI, etc. Corrige cualquier fallo antes de seguir.
5. Haz commit referenciando el issue (ej: `feat: ... (closes #123)`) y pushea la rama de trabajo.
   - Si el commit o el push fallan (hooks, non-fast-forward, lint-staged, etc.), diagnostica la causa y corrígela. Si el push es rechazado, haz `git pull --rebase` sobre la base y reintenta; si necesitas forzar tras un rebase, usa `--force-with-lease`.
   - Reintenta hasta que el push tenga éxito. No pases al siguiente issue sin haber pusheado.
6. Si en cualquier punto encuentras un **error crítico de dependencias** que no puedas resolver (dependencia faltante/incompatible, servicio caído, falta de acceso, etc.):
   - Quita `status:in-progress` y agrega `status:blocked` al issue vía MCP.
   - Detén el trabajo de ese issue y **pide ayuda humana**: explica el error, qué intentaste y qué se necesita para desbloquearlo.
   - Pregunta al usuario si debe saltar el issue y continuar con los demás, o abortar el proceso. Si salta el issue, márcalo como bloqueado en `priorities.md` y continúa con el siguiente.
7. **Borra los archivos de plan generados** para ese issue (los creados por `make-detailed-plan` o por tu planificación). El archivo `priorities.md` se conserva — es el registro de progreso.
8. Quita la etiqueta `status:in-progress` del issue vía MCP y actualiza su estado a completado en `priorities.md`.
9. Pasa al siguiente issue **siempre sobre el código acumulado** en la misma rama de trabajo — nunca vuelvas a la base, para evitar conflictos de merge.

### 5. Crear la rama de release

1. Lee la versión base desde `package.json` (`version`, formato `M.x.y`).
2. Calcula la nueva versión:
   - Si **algún** issue del lote fue una funcionalidad nueva (etiquetas `feature`, `enhancement`, `feat`, o tipo equivalente): incrementa `x` y resetea `y` a 0 → `M.(x+1).0`.
   - Si **todos** fueron fixes de bugs (etiquetas `bug`, `fix`, `hotfix`): incrementa `y` → `M.x.(y+1)`.
   - Si el issue no tiene etiqueta de tipo, infiérelo del título/contenido.
3. Crea la rama `release/v<M.x.y>` desde el tip de la rama de trabajo (contiene todo el trabajo acumulado).
4. Actualiza el número de versión:
   - Si el proyecto tiene un script `update-version` (en `scripts` de `package.json` o un archivo tipo `scripts/update-version*`), úsalo para bump a la nueva versión.
   - Si no existe, edita el campo `version` de `package.json` directamente.
5. Commitea el bump de versión en la rama release y pusheala.

### 6. Publicación y reinicio

- **Si el lote era *publish***:
  1. Haz checkout de `main`, mergea la rama `release/v<M.x.y>` y pushea `main`.
  2. Si el merge falla, resuélvelo (el trabajo es acumulativo desde la última release/main; si hay conflictos, favorece el trabajo nuevo).
  3. Si el proyecto tiene la skill `publish-app` disponible, ejecútala.
  4. **Vuelve al paso 1**: re-consulta los issues `agent-approved` en GitHub (pueden haber aparecido nuevos) y procesa el siguiente lote.
- **Si el lote era *final*** (sin `publish`): no toques `main`. Ve al reporte final.

## Reporte final

Resume al usuario:
- Lotes procesados y, por cada uno: issues (número → título → commit), rama de trabajo, rama de release y versión.
- Si se publicó a `main` y si se corrió `publish-app`.
- Issues omitidos por tener `publish` sin `agent-approved`, y los que quedaron en `status:blocked` pendientes de ayuda humana.
- Cualquier fallo que hayas tenido que resolver en el camino.

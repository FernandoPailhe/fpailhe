# Task 16: Limpiar residuos del template y actualizar README

> Parte del plan: `../plan.md` — leerlo para contexto de alcance y componentes.

## Skill / Capa

Limpieza de repo: README, comentarios, tokens sin uso, archivos huérfanos, strings de UI.

## Objetivo

Eliminar material del proyecto/template anterior y dejar un README que cuente del dueño del sitio. Pasar los mensajes de error de español a inglés (el sitio es íntegramente en inglés).

## Depende De

- Task 07: ESLint/Prettier configurados para detectar problemas de estilo.
- Tasks 01–15: cambios previos que puedan haber dejado comentarios o textos en español.

## Archivos a Crear/Editar

- `README.md` — reescribir
- `packages/ui/src/theme/tokens.ts` — editar (quitar comentario TEMPLATE, revisar tokens silver/bronze)
- `.idea/gran-torneo-tapas-web.iml` — eliminar
- `apps/web/src/main.tsx` — editar (mensaje español)
- `apps/web/src/routes/CVPage.tsx` — editar (mensaje español)
- `apps/web/src/routes/HomePage.tsx` — editar (mensaje español)
- `apps/web/src/components/ErrorState.tsx` — editar (default label)
- `apps/web/src/components/LoadingState.tsx` — editar (default label)
- `apps/web/src/routes/NotFoundPage.tsx` — editar (texto 404)

## Detalles de Implementación

### 1. `README.md`

Reescribir para describir el sitio personal de Fernando Pailhe, no un template genérico. Debe contener:

- Título: `# Fernando Pailhe — Personal Site`.
- Propuesta de valor en 1-2 oraciones (puede reutilizar el hero).
- Stack y arquitectura del monorepo.
- Cómo levantar (`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm preview`).
- Scripts de calidad (`pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test`).
- Estructura de carpetas (`apps/web`, `packages/ui`, `packages/data-model`).
- Deploy: Cloudflare (wrangler), assets esperados en `apps/web/public/`.
- Licencia (si aplica) o nota de copyright.

Eliminar referencias a `items.json`, `meta.json`, `DnfTag`, `PositionChip`, `PtsValue`, `TeamIdentity`, etc. (son del proyecto anterior).

### 2. `packages/ui/src/theme/tokens.ts`

- Quitar el comentario `TEMPLATE: Editá los valores de abajo...`.
- Revisar si `silver`, `silverSoft`, `bronze`, `bronzeSoft`, `bronzeBright` se usan en algún componente. Si no se usan (y según la auditoría apuntan todos al mismo gris sin uso real), eliminarlos del objeto `color`. Si alguno se usa, dejarlo y documentar su uso.
- Para verificar usos: `grep -R "silver\|bronze" apps/web/src packages/ui/src`.
- Renombrar `gold` a `accent`? No — el punto dice "tokens de color sin uso real (silver/bronze)"; no pide renombrar `gold`. Aunque el acento es terracota, no renombrar para evitar riesgo de romper imports. **Fuera de alcance** renombrar tokens existentes.

### 3. `.idea/gran-torneo-tapas-web.iml`

Eliminar el archivo. Es un residuo del proyecto anterior.

### 4. Mensajes de error de español → inglés

Actualizar exactamente estos strings en sus componentes:

- `apps/web/src/main.tsx`:
  ```ts
  throw new Error("Root element not found");
  ```
- `apps/web/src/routes/CVPage.tsx`:
  ```tsx
  <ErrorState label="Could not load CV." />
  ```
- `apps/web/src/routes/HomePage.tsx`:
  ```tsx
  <ErrorState label="Could not load site data." />
  ```
- `apps/web/src/components/ErrorState.tsx`:
  ```ts
  label = "Could not load data.";
  ```
- `apps/web/src/components/LoadingState.tsx`:
  ```ts
  label = "Loading data…";
  ```
- `apps/web/src/routes/NotFoundPage.tsx`:
  ```tsx
  <p className="mb-6 text-ink-dim">The page you are looking for does not exist.</p>
  <Link to="/" ...>Back to home</Link>
  ```

Revisar que no queden otros strings en español en la UI (comentarios en español son aceptables según `.devin/rules/rules.md`; strings de UI deben ser inglés).

## Fuera de Alcance

- No renombrar el scope `@ferpa/*`.
- No modificar `.devin/`.
- No refactorizar componentes que funcionan.

## Verificación

- [ ] `pnpm lint` pasa.
- [ ] `pnpm format:check` pasa.
- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm build` pasa.
- [ ] El archivo `.idea/gran-torneo-tapas-web.iml` no existe.
- [ ] `grep -R "No se\|Cargando\|No se pudo\|La página que buscás" apps/web/src` no devuelve resultados.
- [ ] `grep "TEMPLATE" packages/ui/src/theme/tokens.ts` no devuelve resultados (excepto si aparece en texto legítimo).
- [ ] README.md no menciona `items.json`, `meta.json`, `DnfTag`, `PositionChip`, `PtsValue` ni `gran-torneo-tapas`.

## Handoff

- Produce: repo limpio, README propio, strings de UI en inglés.
- Próximo task: Task 17 (verificación final).

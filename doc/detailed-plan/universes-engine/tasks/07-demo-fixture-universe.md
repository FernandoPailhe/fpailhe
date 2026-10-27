# Task 07: Universo de pruebas `demo-reino`

> Parte del plan: `../plan.md` — **leer "Contenido de prueba (universo `demo-reino`)" (tabla de cobertura obligatoria)**, "Decisiones de Arquitectura" #4 y #5, y "Fuente de Datos".

## Skill / Capa

Datos + tooling. JSON con el mismo formato que producen los skills de `.devin/`. Nada de estética real ni de arte.

## Objetivo

Crear un universo mínimo, completo y jugable, con temática neutra "gobernar un reino", que ejercite **todas** las características del motor. Es el fixture de los tests, de la simulación y de la verificación visual del plan `universes-ui`. **No es contenido de producción**: vive fuera de `content/`.

## Depende De

- Task 04 (motor completo) y Task 05 (validación, ensamblado) — para poder validarlo y simularlo.

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/testing/fixtures/demo-reino/{game,stages,branches,parameters,characters,powers,badges,icons,assets,aesthetic}.json` — crear
- `apps/web/src/lab/universes/testing/fixtures/demo-reino/cards/NNN-nombre.json` — crear (una carta por archivo)
- `apps/web/public/universes/demo-card.svg` — crear (placeholder local, ≤ 2 KB)
- `apps/web/src/lab/universes/testing/loadFixtureBundle.ts` — crear (carga **sincrónica** del fixture para tests)

## Detalles de Implementación

1. **Ids y metadatos**: todo id empieza con `off_` y cumple `/^[A-Za-z0-9_-]+$/`. `Game.slug = "demo-reino"`, `Game.title.default = "Reino de pruebas"`, `status: "published"` (para que aparezca en desarrollo), `defaultLocale: "es"`, `supportedLocales: ["es","en"]`, `config.allowCardFeedback = true`, `metadata.placeholder = true`, `metadata.endings` con `sin_tesoro`, `sin_pueblo`, `coronacion` y `no_cards` (formato `GameEndingsMeta`). `Game.aestheticId = "off_aesthetic_demo_reino"`.
2. **Estética**: `aesthetic.json` es un `AestheticProfile` **completo y válido** (no un stub): `tokens.defaultScheme: "dark"` con `dark` y `light` definidos, `parameterColors` para cada parámetro, `radius`, `motion` (incluye `cardTransition: "fade"`), `typography` con `fonts.display/body` de `source: "system"` con `fallback`, `scale` completa, `iconStyle` (`variant: "line"`, `colorMode: "currentColor"`) y **un** `ThemeOverride` (`when: in_branch(guerra)`, `colors: { accent: <otro tono> }`). Todos los pares de color de texto deben cumplir contraste AA (4.5:1): el plan `universes-ui` los verificará. Los valores hex son **datos del universo** (permitido por `rules.md` §2: color de entidad de dominio).
3. **Íconos**: `icons.json` define un `Icon` con `svg` **inline** para cada parámetro, poder e insignia (`currentColor`, trazos simples, `viewBox="0 0 24 24"`), con `label.default` y `semanticTags`. Un parámetro y un poder se dejan **sin** `iconId` a propósito (para cubrir el fallback de la UI).
4. **Cobertura**: cumplir **cada fila** de la tabla de cobertura del plan. Cantidad de cartas: la mínima que permita cubrir la tabla y mantener el pool no vacío en cada etapa (orientativo: 25–35). Cada carta lleva `createdBy: "system"`, `origin: "official"`, `status: "published"`. Los assets de carta apuntan a `/universes/demo-card.svg`.
5. **`loadFixtureBundle.ts`**: usa `import.meta.glob("./fixtures/demo-reino/*.json", { eager: true, import: "default" })` y `import.meta.glob("./fixtures/demo-reino/cards/*.json", { eager: true, import: "default" })`; devuelve un `RawGameBundle` con un único cast documentado (`as unknown as RawGameBundle`). Solo para tests (no lo importa código de runtime).

## Fuera de Alcance

- Contenido real de cualquier universo.
- Registrar el fixture en `content/` o en el registro (el task 06 ya lo descubre por la regla DEV/test).
- Arte, íconos definitivos, traducciones más allá de las pedidas en la tabla.

## Verificación

- [ ] `pnpm vitest run --project web src/lab/universes/testing` (un test mínimo de sanidad: `assembleGameContent(loadFixtureBundle())` produce `cards.length > 0` y `validateGameContent` sin errores).
- [ ] `pnpm dev` y abrir `/lab/universes` (cuando exista el task 12) lista "Reino de pruebas".
- [ ] `grep -rEn "node:|from \"fs\"" apps/web/src/lab/universes/testing` vacío en los JSON/archivos de runtime.

## Handoff

Produce: el universo `demo-reino` válido y jugable, `loadFixtureBundle()` para tests. Task 08 lo valida y simula; el plan `universes-ui` lo usa para verificar visualmente.

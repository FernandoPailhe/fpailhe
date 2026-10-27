# Task 04: HUD de partida — íconos, parámetros, poderes, etapa, turno y puntaje

> Parte del plan: `../plan.md` — "Decisiones de Diseño" #7, #8, "Estados de componente", "Reglas de estilo" y "Accesibilidad". Spec: `doc/specs/lab/universes/narratives-aesthetics.md` §7.

## Skill / Capa

`add-ui-component`. Presentación pura a partir de `ParameterView`, `PowerView` y `StageView` (del módulo `application`) y de `NarrativeGame.icons` (`IconView`, del contrato del motor).

## Objetivo

Mostrar en todo momento el estado de la partida: parámetros activos con su ícono, riesgo de umbral y último cambio, poderes con cargas, etapa, turno y puntaje; con la cadena de fallback de íconos del spec.

## Depende De

- Task 02.
- Motor, task 11 (campos `ratio`, `delta`, `risk`, `charges`, `maxCharges`, `iconId`, `stage.order/total`) y task 07 (`demo-reino` con íconos).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/theme/iconResolver.ts` + `iconResolver.test.ts` — crear
- `apps/web/src/lab/universes/theme/sanitizeSvg.ts` + `sanitizeSvg.test.ts` — crear
- `apps/web/src/lab/universes/components/{UniverseIcon,ParameterBar,ParametersPanel,PowerChip,PowersRow,StageBanner,Hud}.tsx` — crear
- `apps/web/src/lab/universes/components/universes.css` — editar
- `apps/web/src/lab/universes/routes/UniversePlayPage.tsx` — editar (renderizar `<Hud>` en `card` y `outcome`)

## Detalles de Implementación

1. **`sanitizeSvg(svg: string): string | null`**: parsea con `DOMParser` (solo si existe; en SSR devuelve `null`), conserva únicamente elementos `svg, g, path, circle, ellipse, rect, line, polyline, polygon, defs, linearGradient, radialGradient, stop, title, desc` y atributos de presentación/geometría (`d, cx, cy, r, rx, ry, x, y, x1, y1, x2, y2, width, height, points, viewBox, fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, opacity, transform, offset, stop-color, id`), descarta `on*`, `style`, `href`/`xlink:href` y todo lo demás; fija `fill="currentColor"` en el `<svg>` raíz si no tiene `fill`. Devuelve `outerHTML` o `null` si no hay `<svg>`.
2. **`iconResolver`** `resolveIcon({ iconId, fallbackTags, name, icons })` con `icons: Record<ID, IconView>` ⇒ `{ kind: "svg"; svg: string; label: string } | { kind: "initial"; initial: string; label: string }`: (1) `icons[iconId]` con `svg` sanitizado válido; (2) primer ícono de `icons` cuyos `semanticTags` intersecten `fallbackTags` (p. ej. `["shield"]` para poderes `shield`); (3) inicial del `name` (primera letra mayúscula) dentro de un círculo. Un `svg` que no sanitice ⇒ siguiente paso. Pura salvo `DOMParser`.
3. **`UniverseIcon`** `{ resolved; size?: number; decorative?: boolean; colorVar?: string }`: `kind: "svg"` ⇒ `<span class="uv-icon" role="img" aria-label={label}>` con `dangerouslySetInnerHTML` del SVG sanitizado (único uso permitido; comentar por qué es seguro) — si `decorative`, `aria-hidden` y sin `role`; `kind: "initial"` ⇒ círculo con la inicial. El color viene de `colorVar` (p. ej. `var(--uv-param-<id>)`) o `currentColor`.
4. **`ParameterBar`** `{ view: ParameterView; icon: ResolvedIcon }`: fila: ícono + nombre (`label`) + valor (`number`) + barra de **4 px** (pista `--uv-color-border`, relleno `--uv-param-<id>` con `transform: scaleX(ratio)`); `role="meter"`, `aria-valuemin/max/now`, `aria-label={view.name}`, `aria-valuetext` ("32 de 100, riesgo bajo"). Primera vez que aparece un parámetro en la partida: ícono + nombre; luego solo ícono + valor (con `title`/tooltip del nombre) — el estado "ya visto" vive en un `useRef<Set<ID>>` del `Hud`. `view.risk` ⇒ chip con glifo + texto ("▼ CRÍTICO BAJO" / "▲ CRÍTICO ALTO") usando `--uv-color-warning` en texto y borde; `view.delta` no `null` ⇒ "▲ +8" / "▼ −5" visible durante `outcome`, animación `uv-fade-in` solo sin reduced-motion.
5. **`ParametersPanel`**: grilla de 1 columna (móvil) y 2 desde 681 px (`repeat(auto-fit, minmax(…, 1fr))`, nunca anchos fijos). Recibe `ParameterView[]` (solo activos, en orden).
6. **`PowerChip` / `PowersRow`** `{ power: PowerView; icon }`: chip con ícono (`fallbackTags` según `kind`) + nombre + cargas ("×2", "/máx" si `maxCharges`); `aria-label` completo ("Guardia, escudo, 2 cargas"). Sin poderes ⇒ no se renderiza la fila.
7. **`StageBanner`** `{ stage: StageView; turn: number; score: number }`: "ETAPA 2/3 · TURNO 14 · PUNTOS 120" (`accent`, `label`) y el nombre de la etapa (`display`).
8. **`Hud`** `{ game }` (recibe las partes del `NarrativeGame`, no el hook): `StageBanner` → `ParametersPanel` → `PowersRow`, separados por 1 px `--uv-color-border`. En móvil el HUD queda arriba y **no** es `sticky`.

## Fuera de Alcance

- `states` de íconos (`danger`/`full`/`locked`), imágenes como ícono (`assetId`) — se usa solo `svg` inline; un ícono con `assetId` sin `svg` cae al paso (2)/(3).
- Tooltips complejos, animaciones de barras, gráficos.

## Verificación

- [ ] Tests: `sanitizeSvg` quita `<script>`, `onload`, `href` externos y `style`; conserva paths; `resolveIcon` recorre la cadena (propio → por tags → inicial) incluyendo un SVG inválido; `ParameterBar` expone `role="meter"` con valores correctos y chip de riesgo con texto.
- [ ] Con `demo-reino` (que deja un parámetro y un poder sin `iconId`): el sin ícono usa el genérico por tags o la inicial; no hay errores en consola.
- [ ] Forzar un parámetro cerca de un umbral muestra el chip con glifo y texto; el significado no depende del color.
- [ ] 360 px: 1 columna sin scroll horizontal; 1280 px: 2 columnas.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`; sin hex.

## Handoff

Produce: `Hud` y sus partes, `UniverseIcon`, `resolveIcon`, `sanitizeSvg`. Task 05 coloca la carta debajo del HUD; Task 06 usa `UniverseIcon` en los eventos.

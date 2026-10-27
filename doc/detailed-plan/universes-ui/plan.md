# Plan: Universes — UX/UI v1 (jugable, con estética por universo)

## Objetivo

Construir la primera interfaz de `/lab/universes` suficiente para **jugar una partida completa de principio a fin** (lista de universos → inicio → cartas y decisiones → resultado de cada decisión → final → volver a jugar), en escritorio y móvil, accesible por teclado, **con la identidad visual propia de cada universo** tomada de su `AestheticProfile` (colores, tipografías, íconos, radios, movimiento), sin tocar componentes para cambiar de universo.

Alcance de la estética: se implementa el **runtime** de `doc/specs/lab/universes/narratives-aesthetics.md` (§5 tokens y tematización, §6.1–6.2 tipografía por roles, §7 íconos con fallback, §9 degradación, validaciones de contraste de §8). **No** se implementa la generación de imágenes (§4), la carga de fuentes externas, ni la pantalla Style Guide.

## Fuente de Requerimientos

- `doc/detailed-plan/universes-engine/plan.md` → "Contrato para la UI" (`useNarrativeGame`, view models, `ThemeInput`) y "Estructura de archivos". **La UI solo importa de `lab/universes/application` y de los tipos de `lab/universes/domain`.**
- `doc/specs/lab/universes/narratives-aesthetics.md` — estética por juego (fuente de verdad) y `narrative-game-models.ts §9` (`AestheticProfile`, `DesignTokens`, `ColorScheme`, `Typography`, `Icon`, `ThemeOverride`).
- Reglas del repo: `.devin/rules/rules.md` (§2 tokens solo en `packages/ui/src/theme/tokens.ts`; **los colores de una entidad de dominio —aquí, la paleta de cada universo— son datos**, no tokens; §7 accesibilidad; §11 responsive, breakpoint 680px; §12 convenciones). Skills: `add-ui-component`, `responsive-layout`, `theming`.
- Origen del diseño: adaptación del plan `emperabord-ux-v1` de gran-torneo-tapas-web (no hace falta consultarlo).

## Prerrequisitos (del plan `universes-engine`)

| Necesario | Task del motor |
| --- | --- |
| `useNarrativeGame` y view models, `ThemeInput` | 11 |
| Rutas `/lab/universes`, `/:slug`, `/jugar`, `/final` con páginas y layout stub | 12 |
| Universo `demo-reino` con `AestheticProfile` completo, íconos SVG y un `ThemeOverride` | 7 |
| Esqueleto de guards de ESLint | 1 |

## Decisiones de Diseño

| # | Decisión | Motivo |
| --- | --- | --- |
| 1 | Todo el código de UI vive en `apps/web/src/lab/universes/components/` y `…/theme/`; estilos propios en `components/universes.css`, todo bajo la clase raíz `.uv`, prefijo `uv-` en cada clase. | Módulo autónomo y extraíble; sin colisiones con el resto del sitio. |
| 2 | **La paleta de un universo son datos.** Un `ThemeScope` convierte `AestheticProfile` → variables CSS `--uv-*` (inline `style` del contenedor `.uv`). Ningún componente ni CSS usa colores o fuentes literales: solo `var(--uv-…)`. | Cumple `narratives-aesthetics.md` §5.2 y `rules.md` §2: cambiar de universo cambia el look sin tocar componentes. |
| 3 | **Tema de plataforma como respaldo** (universo sin `aesthetic`, perfil inválido o campo faltante): un `ColorScheme` neutro construido desde los tokens existentes de `@ferpa/ui` (`packages/ui/src/theme/tokens.ts`), nunca hex nuevos en el módulo. Si falta algún valor imprescindible, se agrega **en `tokens.ts`** (sin cambiar valores existentes). | `narratives-aesthetics.md` §9 ("`aestheticId` inválido ⇒ tema por defecto de la plataforma"). |
| 4 | Esquema claro/oscuro: `defaultScheme` del perfil; se respeta `prefers-color-scheme` **solo si el perfil define ambos**. Si define uno solo, se usa ese. | Spec §5.1. |
| 5 | `ThemeOverride` (rama/etapa) se evalúa en el hook (`theme.activeOverrides`, ya resuelto con `evaluateCondition`); la UI solo los **mezcla** sobre los tokens base y anima el cambio con `transition` de CSS. Con `prefers-reduced-motion` no hay transición. | Spec §5.2. |
| 6 | Tipografía: roles `display`, `body`, `accent` → `--uv-font-display/body/accent` = `family` + `fallback` del perfil; la escala (`title`, `cardText`, `option`, `label`, `number`, `caption`) → variables `--uv-type-<nombre>-*`. **Esta versión no descarga fuentes** (`source: "google"`/`"self_hosted"` usan el `fallback` hasta que exista el plan de carga). | Evita dependencias y requests; degrada como pide el spec §6.3/§9. |
| 7 | Íconos: `UniverseIcon` resuelve `iconId` → ícono por `semanticTags` → inicial dentro de un círculo con el color del parámetro (spec §7.5). SVG inline **sanitizado** (se descartan `<script>`, `on*`, `href` externos) y siempre con `currentColor` por defecto. El nombre localizado queda como `aria-label`/tooltip. | Spec §7; el SVG viene del repo pero se sanitiza por defensa. |
| 8 | El significado nunca depende solo del color: riesgo, bloqueo y tono de evento llevan glifo/ícono + texto; parámetros = ícono + valor + barra. | Spec §7.4 y accesibilidad. |
| 9 | Medios: si `CardView.media` existe se muestra; si hay `speaker` se muestra su retrato; sin ninguno, marcador tipográfico (inicial). | Prioridad del spec (asset > retrato > texto). |
| 10 | Movimiento: `cardTransition` del perfil (`slide`/`fade`/`flip`/`stack`) → clase `uv-enter-<tipo>` con duraciones `--uv-motion-*`. Con reduced-motion se usa solo un `fade` muy corto. | Spec §5.3. |
| 11 | Textos de la UI propia (botones, etiquetas) en español, centralizados en `lib/copy.ts`; los textos del juego vienen localizados por el hook. | Facilita traducir la UI después. |
| 12 | Breakpoint móvil `max-width: 680px` (igual que el resto del sitio); sin librerías de UI ni de animación nuevas. | `rules.md` §11, §9. |

## Estructura de archivos

```
apps/web/src/lab/universes/
  theme/
    contrast.ts            # ratio WCAG, parseo de colores (#rgb/#rrggbb/rgb())      (+ test)
    platformTheme.ts       # ColorScheme de respaldo desde @ferpa/ui                 (+ test)
    composeTheme.ts        # perfil + esquema + overrides → ResolvedTheme            (+ test)
    themeVars.ts           # ResolvedTheme → Record<"--uv-…", string>                (+ test)
    useColorScheme.ts      # prefers-color-scheme seguro (sin window en SSR)
    iconResolver.ts        # cadena de fallback de íconos                            (+ test)
    sanitizeSvg.ts         # sanitizador mínimo de SVG inline                        (+ test)
    index.ts
  components/
    universes.css          # único CSS de la UI
    UniversesLayout.tsx    # (existe como stub) ThemeScope + cabecera + <Outlet/> + pie
    ThemeScope.tsx         # aplica variables, lang y esquema al contenedor .uv
    UniverseIcon.tsx  StatusPill.tsx  UniverseListItem.tsx
    StartScreen.tsx  EndScreen.tsx  ErrorScreen.tsx  LoadingScreen.tsx
    Hud.tsx  ParameterBar.tsx  ParametersPanel.tsx  PowerChip.tsx  PowersRow.tsx  StageBanner.tsx
    SituationCard.tsx  CardMedia.tsx  OptionButton.tsx  OptionList.tsx  useOptionHotkeys.ts
    OutcomePanel.tsx  EventChip.tsx  LiveAnnouncer.tsx
    index.ts
  routes/  UniversesIndexPage.tsx  UniversePage.tsx  UniversePlayPage.tsx  UniverseEndPage.tsx   # (existen como stubs; se rehacen)
  lib/copy.ts
```

## Pantallas por página y fase (`game.phase`)

| Página | Fase | Pantalla |
| --- | --- | --- |
| Lista | — | Título "Universos" + `UniverseListItem` por universo (título, descripción, enlace); vacía ⇒ mensaje |
| Inicio | `loading` | `LoadingScreen` |
| Inicio | `error` | `ErrorScreen` ("Reintentar" = `retry()`); si `notFound`, mensaje "Universo no encontrado" y enlace a la lista |
| Inicio | `no_session` | `StartScreen`: título, `description`, CTA "Jugar" (`startNewGame()` y navega a `/jugar`) |
| Inicio | `between` / `card` / `outcome` (partida activa guardada) | `StartScreen` con "Continuar" (navega a `/jugar`) y "Nueva partida" (confirmación en dos pasos, luego `startNewGame()`) |
| Inicio | `ended` | `StartScreen` con "Ver final" (a `/final`) y "Nueva partida" |
| Juego | `loading` | `LoadingScreen` |
| Juego | `card` | `Hud` + `SituationCard` + `OptionList` (+ "Abandonar" discreto) |
| Juego | `outcome` | `Hud` + `OutcomePanel` |
| Juego | `no_session` / `ended` | redirección (`redirectFor`, engine task 12) |
| Final | `ended` | `EndScreen`: resultado, título y texto del final, resumen, "Jugar de nuevo" |
| Final | `no_session` / partida activa | redirección (`redirectFor`) |

## Estados de componente a cubrir

- `OptionButton`: `available`, `locked` (`aria-disabled`, razón `lockedReason` visible), foco, pulsado (feedback inmediato, sin doble envío).
- `ParameterBar`: normal, `risk: "low" | "high"` (glifo ▼/▲ + etiqueta), cambio reciente (`delta`: flecha + valor; sin movimiento con reduced-motion).
- `UniverseIcon`: ícono propio, ícono genérico por tags, inicial en círculo (fallback), con y sin etiqueta visible.
- `PowerChip`: con cargas (`charges`/`maxCharges`); un poder sin cargas no llega (el hook solo entrega los poseídos).
- `StatusPill`: `live` / `ended` con punto (parpadeo solo en `live` y sin reduced-motion).
- `EventChip`: tono `gain` / `loss` / `neutral` con glifo + texto.
- `ThemeScope`: perfil válido, perfil ausente (tema de plataforma), override activo (transición), un color inválido (se ignora ese valor y usa el del tema de plataforma).

## Reglas de estilo

- Todos los colores salen de `--uv-color-*` (`background`, `surface`, `surfaceAlt`, `border`, `textPrimary`, `textSecondary`, `accent`, `accentContrast`, `positive`, `negative`, `warning`, `info`, `overlay`) y `--uv-param-<id>`; radios de `--uv-radius-*`; sombras de `--uv-shadow-*`; duraciones de `--uv-motion-*`. **Cero hex y cero `px` de color en CSS/TSX**.
- Fuentes: `font-family: var(--uv-font-body)` etc.; tamaños/interlineado de `--uv-type-*` (valores de la escala del perfil).
- Barras de parámetros: relleno con `--uv-param-<id>` (o `--uv-color-accent` si falta), pista con `--uv-color-border`; alto 4 px; `role="meter"` con `aria-valuenow/min/max`, `aria-label` y `aria-valuetext`.
- Botones de opción: altura mínima 48 px, borde `--uv-border-width` con `--uv-color-border`; foco/hover con relleno `--uv-color-accent` y texto `--uv-color-accentContrast`.
- Jerarquía: título (`display`) › texto de carta (`body`, `cardText`) › etiquetas y números (`accent`, `label`/`number`).
- Contenedor `max-width` ≈ 720 px centrado; en móvil, padding lateral 16 px.

## Accesibilidad

- Una región `aria-live="polite"` anuncia el resultado de cada decisión y los cambios de etapa.
- Al cambiar de fase o de página, el foco va al encabezado de la nueva pantalla (`tabIndex={-1}` + `focus()`); en `outcome`, al botón "Continuar".
- Todo operable con teclado; atajos opcionales `1`–`3` para las opciones (inactivos dentro de campos de texto).
- Contraste AA verificado **por el build** para cada universo publicado (engine task 08 + task 07 de este plan): `textPrimary/background`, `textPrimary/surface`, `textSecondary/surface`, `accentContrast/accent` y cada `parameterColors` contra `surface`, en los esquemas que existan.
- Todo ícono tiene `aria-label` localizado o es decorativo (`aria-hidden`) junto a su texto.
- `prefers-reduced-motion`: sin parpadeo ni desplazamientos.
- `<html lang>` o `lang` del contenedor = `NarrativeGame.locale`.

## Secuencia de Implementación

| # | Task | Depende de |
| --- | --- | --- |
| 01 | `tasks/01-theme-pipeline.md` | engine 11 |
| 02 | `tasks/02-shell-and-universe-list.md` | 01, engine 12 |
| 03 | `tasks/03-start-end-error-screens.md` | 02 |
| 04 | `tasks/04-hud-icons-parameters.md` | 02 |
| 05 | `tasks/05-card-and-options.md` | 04 |
| 06 | `tasks/06-outcome-and-events.md` | 05 |
| 07 | `tasks/07-responsive-a11y-motion-contrast.md` | 03, 06 |
| 08 | `tasks/08-playthrough-verification.md` | 07 |

Paralelismo: 03 y 04 pueden hacerse a la vez tras el 02.

## Criterios de Aceptación

- [ ] Se completa una partida (victoria y derrota) usando solo la UI, con mouse **y** solo con teclado.
- [ ] Cada fase de cada página tiene pantalla; ninguna muestra datos crudos (ids, JSON).
- [ ] **Cambiar la estética de un universo cambia colores, fuentes, íconos, radios y animaciones sin modificar componentes** (test automático + verificación visual con dos perfiles).
- [ ] El `ThemeOverride` de rama cambia la paleta al entrar a la rama y revierte al salir, con transición (y sin ella con reduced-motion).
- [ ] Ícono faltante, color inválido o perfil ausente degradan sin errores visibles (cadena de fallback).
- [ ] Las opciones bloqueadas muestran su razón; las ocultas no aparecen.
- [ ] Tras cada decisión se ve qué cambió y cuánto (eventos + `delta` en el HUD).
- [ ] Recargar en `/lab/universes/:slug/jugar` restaura la partida; el inicio ofrece "Continuar".
- [ ] 360 px y 1280 px sin scroll horizontal; objetivos táctiles ≥ 44 px.
- [ ] Contraste AA en todo el texto del tema de plataforma y del perfil de `demo-reino`; el build falla si un universo publicado no lo cumple.
- [ ] Ningún parámetro se comunica solo por color.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` en verde; `/`, `/cv`, `/projects/:id` y `/lab/trymate` sin cambios.
- [ ] Cero hex hardcodeados en `universes.css` y componentes; cero cambios en `packages/ui` salvo, de ser imprescindible, tokens **nuevos** (sin cambiar valores).

## Fuera de Alcance

- Generación y gestión de imágenes (`composePrompt`, `assets:outdated`), pantalla Style Guide, carga de fuentes `google`/`self_hosted`, `localeOverrides` de fuentes, íconos con `states` (`danger`/`full`/`locked`).
- Animaciones elaboradas, sonido, transiciones de página.
- Selector de idioma, ajustes, historial de partidas, perfil.
- Editor de cartas y feedback (plan `universes-community`).
- Enlace desde la home o el CV.

## Preguntas Abiertas / Supuestos

1. Texto de presentación del inicio: `Game.description` y un eyebrow constante en `copy.ts` ("Universo").
2. Puntaje durante la partida: se muestra, discreto, en el HUD.
3. Carga de fuentes: universos reales con fuentes `google`/`self_hosted` verán el `fallback` hasta que exista un plan de carga (se anota en `ACCEPTANCE.md`).
4. La UI propia (botones) queda solo en español en esta versión.
5. Nombres exactos de los tokens de `@ferpa/ui` que alimentan el tema de plataforma: se determinan leyendo `packages/ui/src/theme/tokens.ts` en el task 01.

# Reporte de accesibilidad — universos

Verificación de la task 07 del plan `universes-ui`. Ratios medidos con `theme/contrast.ts` (misma implementación que valida el build).

## Tabla de contraste

### Tema de plataforma (fallback)

| Par | Ratio | Mínimo AA | Cumple |
|---|---|---|---|
| textPrimary/background | 17.52 | 4.5 | ✔ |
| textPrimary/surface | 18.58 | 4.5 | ✔ |
| textSecondary/surface | 7.23 | 4.5 | ✔ |
| accentContrast/accent | 4.71 | 4.5 | ✔ |

### demo-reino — esquema claro

| Par | Ratio | Mínimo | Cumple |
|---|---|---|---|
| textPrimary/background | 14.72 | 4.5 | ✔ |
| textPrimary/surface | 16.32 | 4.5 | ✔ |
| textSecondary/surface | 7.96 | 4.5 | ✔ |
| accentContrast/accent | 6.12 | 4.5 | ✔ |
| param tesoro | 4.49 | 3 | ✔ |
| param pueblo | 5.25 | 3 | ✔ |
| param ejército | 4.50 | 3 | ✔ |
| param prestigio | 5.13 | 3 | ✔ |

### demo-reino — esquema oscuro

| Par | Ratio | Mínimo | Cumple |
|---|---|---|---|
| textPrimary/background | 16.72 | 4.5 | ✔ |
| textPrimary/surface | 15.13 | 4.5 | ✔ |
| textSecondary/surface | 9.12 | 4.5 | ✔ |
| accentContrast/accent | 8.36 | 4.5 | ✔ |
| param tesoro | 3.71 | 3 | ✔ |
| param pueblo | 3.17 | 3 | ✔ |
| param ejército | 3.70 | 3 | ✔ |
| param prestigio | 3.25 | 3 | ✔ |

**Override `off_override_guerra`** (rama guerra, accent ámbar): al validarlo se detectó que `accentContrast` heredado rompía AA en el esquema claro (3.56 < 4.5) — corregido declarando `accentContrast` propio en el override (`#140f0c`, ≥4.5 en ambos esquemas). La regla `A_OVERRIDE_INVALID` del build lo detectó.

## Validación en build

`pnpm universes:validate` corre `testing/aesthetic.test.ts`, que ejecuta `validateAesthetic()` sobre cada bundle (`content/*` + fixtures):

- `published` ⇒ 0 errores `A_*` permitidos (warnings `A_NO_ICON`/`A_PARAM_COLOR` se reportan).
- Sabotaje verificado: bajar el contraste de `textPrimary` falla con `A_CONTRAST`; fuente sin `fallback` falla con `A_FONT_MISSING` (tests unitarios de `validateAesthetic`).

## Checklist de teclado y lector de pantalla

| Ítem | Resultado |
|---|---|
| Un solo `<h1>` por pantalla | ✔ (index/universe/end: h1 visible; play: h1 `uv-sr-only` + h2 por sección) |
| Foco al cambiar de fase | ✔ `useFocusOnMount` en h1 de start/end/error; encabezado `tabIndex={-1}` de la carta al volver; botón "Continuar" al entrar a `outcome` |
| Foco visible | ✔ `outline` 2×border-width en `--uv-color-accent` (≥3:1 contra fondo en ambos esquemas) |
| Orden de tabulación | ✔ header → HUD → carta → opciones → abandonar |
| `aria-live` único | ✔ `LiveAnnouncer` `role="status"` resume el turno (elección + eventos) |
| `role="meter"` en parámetros | ✔ con `aria-valuemin/max/now` y `aria-valuetext` ("32 de 100, riesgo bajo") |
| Opciones bloqueadas | ✔ `aria-disabled` + razón visible (el lector la lee; no `disabled` para no perder contexto) |
| Significado sin color | ✔ glifos + texto: ▲/▼ deltas, ⊘ bloqueada, CRÍTICO BAJO/ALTO, EQUILIBRIO, VICTORIA/DERROTA/ABANDONADA, íconos con `role="img"`/`aria-hidden` |
| Saltar al contenido | ✔ enlace `.uv-skip` a `#main-content` (visible al enfocar) |
| Teclas 1–3 | ✔ eligen opción disponible; ignoran inputs y modificadores |
| `lang` del contenedor | ✔ `ThemeScope lang={locale}` (locale de la sesión) |
| Hotspots táctiles | ✔ opciones ≥48px, botones ≥44px, `touch-action: manipulation` |

## Checklist responsive / movimiento

| Ítem | Resultado |
|---|---|
| 360 px sin scroll horizontal | ✔ `.uv` `overflow-x: hidden`, grillas `auto-fit`, shell `padding-inline: 16px` ≤680px |
| ≥2 columnas de parámetros ≥681px | ✔ `repeat(auto-fit, minmax(240px, 1fr))` |
| HUD no sticky | ✔ queda arriba, scrollea con el contenido |
| `prefers-reduced-motion` | ✔ regla global: animaciones/transiciones a 1ms; parpadeo del `StatusPill` anulado; `uv-enter-*` del perfil queda en fade instantáneo; video sin autoplay |
| Colores literales en CSS | ✔ `grep` vacío: todo consume `var(--uv-*)` |

## Notas

- Las paletas de `parameterColors` son datos del universo; `validateAesthetic` exige ≥3 contra `surface` en **ambos** esquemas, lo que restringe a tonos medios — documentado para creadores en la guía de estética.
- No se hizo simulación de daltonismo sobre paletas de parámetros (fuera de alcance; los glifos y textos no dependen del color).

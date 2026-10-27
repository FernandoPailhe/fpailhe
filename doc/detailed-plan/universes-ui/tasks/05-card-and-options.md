# Task 05: Carta de situación y opciones de decisión

> Parte del plan: `../plan.md` — "Pantallas por página y fase" (Juego · `card`), "Estados de componente" (`OptionButton`) y "Decisiones de Diseño" #9, #10.

## Skill / Capa

`add-ui-component` + integración en la página.

## Objetivo

Mostrar la carta actual (texto, personaje y medio opcional) y sus 1–3 opciones, permitiendo elegir con mouse, táctil y teclado, manejando opciones bloqueadas y aplicando la `cardTransition` del universo.

## Depende De

- Task 04.
- Motor, task 11 (`CardView`, `OptionView`, `SpeakerView`, `MediaView`, `choose`).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/components/{SituationCard,CardMedia,OptionButton,OptionList}.tsx` — crear
- `apps/web/src/lab/universes/components/useOptionHotkeys.ts` — crear
- `apps/web/src/lab/universes/components/universes.css` — editar
- `apps/web/src/lab/universes/routes/UniversePlayPage.tsx` — editar (fase `card`)

## Detalles de Implementación

1. **`SituationCard`** `{ card: CardView }`:
   - Cabecera con el `speaker` (nombre y `title`, fuente `accent`) si existe, con retrato circular pequeño cuando hay `portraitUrl` (`alt` = `portraitAlt ?? ""`).
   - `CardMedia` si hay `card.media`: `image` ⇒ `<img>` con `alt`, `loading="lazy"` y relación de aspecto fija (evita saltos de layout); `video`/`animation` ⇒ `<video>` con `poster`, `controls`, sin autoplay con sonido (con reduced-motion no se reproduce solo); si falla la carga (`onError`) se oculta y queda el retrato o solo el texto (prioridad del spec). Sin `media` ni `speaker`, marcador tipográfico (inicial del universo). No mostrar `difficulty` al jugador.
   - Texto con el estilo `cardText` de la escala (`--uv-type-cardText-*`), ancho de línea ≤ 65ch, `white-space: pre-line`.
   - `<article aria-labelledby>` con encabezado accesible `.uv-sr-only` ("Situación").
   - **Transición de entrada**: la clase `uv-enter-<tipo>` (`slide`, `fade`, `flip`, `stack`; el tipo viene de `data-card-transition` del contenedor, que fija `ThemeScope` según perfil/override) se reaplica con `key={card.id}`; duraciones de `--uv-motion-*`. Los keyframes viven en `universes.css`; con reduced-motion todos se reducen a un `fade` de ≤ 100 ms.
2. **`OptionList`** `{ options: OptionView[]; onChoose(id): void; busy?: boolean }`: `<ul>` de `OptionButton`; las opciones ocultas ya no llegan.
3. **`OptionButton`**:
   - `<button type="button">` con la etiqueta (`label`, estilo `option`), numeral (`accent`) `1`, `2`, `3` a la izquierda.
   - `available`: borde `--uv-border-width` en `--uv-color-border`; hover/foco con relleno `--uv-color-accent` y texto `--uv-color-accentContrast`; anillo de foco visible.
   - `locked`: `aria-disabled="true"` (no `disabled`, para que el lector lea la razón), texto atenuado (`--uv-color-textSecondary`), glifo ⊘ y `lockedReason` visible debajo; el clic no hace nada.
   - `kind: "balance"`: etiqueta "EQUILIBRIO" (texto, no solo color).
   - Altura mínima 48 px; admite varias líneas.
   - Tras elegir, `busy` marca la lista con `aria-busy` hasta que cambie la fase (el hook ya ignora dobles `choose`; esto es solo feedback).
4. **`useOptionHotkeys(options, onChoose, enabled)`**: teclas `1`–`3` eligen la opción **disponible** correspondiente; ignora si el foco está en `input/textarea/select/contenteditable` o hay modificadores; solo activo en fase `card`.
5. **`UniversePlayPage`** (fase `card`): `<Hud/>` + `<SituationCard/>` + `<OptionList onChoose={game.choose}/>` + botón secundario "Abandonar partida" (`game.abandon()`, con `useTwoStepConfirm` del task 03).

## Fuera de Alcance

- Arte de cartas, gestos tipo "swipe", revelar efectos antes de elegir (el diseño del juego lo evita).

## Verificación

- [ ] Se juega un turno con mouse, táctil (emulación) y teclado (`Tab`+`Enter` y `1`–`3`).
- [ ] La opción bloqueada de `demo-reino` muestra razón y no responde al clic ni a la tecla.
- [ ] Carta sin medio, con retrato y con imagen se ven sin saltos de layout.
- [ ] Cambiar `cardTransition` en el perfil de prueba (`fade` → `slide`) cambia la animación sin tocar componentes; con reduced-motion emulado, solo un fade breve.
- [ ] 360 px: opciones a ancho completo y texto legible sin zoom.
- [ ] "Abandonar partida" lleva a `/lab/universes/:slug/final` con el resultado "abandonada".
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`; sin hex.

## Handoff

Produce: carta y opciones jugables. Task 06 muestra el resultado de la decisión.

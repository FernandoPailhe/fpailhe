# Task 06: Resultado de la decisión y eventos

> Parte del plan: `../plan.md` — "Pantallas por página y fase" (Juego · `outcome`), "Estados de componente" (`EventChip`) y "Accesibilidad" (región `aria-live`).

## Skill / Capa

`add-ui-component` + integración en la página.

## Objetivo

Después de cada decisión, mostrar qué pasó (texto de resultado y eventos), anunciarlo a tecnologías de asistencia y permitir continuar al siguiente turno o al final.

## Depende De

- Task 05.
- Motor, task 11 (`OutcomeView`, `EventView`, `next`).

## Archivos a Crear/Editar

- `apps/web/src/lab/universes/components/{OutcomePanel,EventChip,LiveAnnouncer}.tsx` — crear
- `apps/web/src/lab/universes/components/universes.css` — editar
- `apps/web/src/lab/universes/routes/UniversePlayPage.tsx` — editar (fase `outcome`)

## Detalles de Implementación

1. **`EventChip`** `{ event: EventView }`: chip con glifo + texto por `tone` (`gain`: ▲, `--uv-color-positive`; `loss`: ▼, `--uv-color-negative`; `neutral`: ●, `--uv-color-textSecondary`). El texto ya viene localizado ("Tesoro +8"). El color nunca es el único portador de significado.
2. **`OutcomePanel`** `{ outcome: OutcomeView; onContinue }`: muestra `chosenLabel` ("Elegiste: …"), `outcomeText` (si existe), la lista de `EventChip` (`<ul>`; agrupar visualmente parámetros / otros) y el botón "Continuar" (`onContinue`), o "Ver final" si `outcome.ended`. Si el juego terminó, mostrar además la etiqueta de resultado en texto ("VICTORIA"/"DERROTA").
3. **`LiveAnnouncer`** `{ message: string }`: `<div aria-live="polite" role="status" class="uv-sr-only">`; el mensaje se arma con `chosenLabel` + los textos de los eventos (+ cambio de etapa) al entrar en `outcome`. Un solo anunciador por pantalla.
4. **Foco**: al entrar en `outcome`, el foco va al botón "Continuar" (`autoFocus` controlado con `ref` + `useEffect`); al volver a `card`, al encabezado de la carta (`tabIndex={-1}`).
5. **`UniversePlayPage`** (fase `outcome`): `<Hud/>` (con `delta` visibles) + `<OutcomePanel/>` + `<LiveAnnouncer/>`; `next()` en "Continuar".

## Fuera de Alcance

- Feedback de cartas (👍/👎) — plan `universes-community`; el contrato ya trae `feedbackEnabled = false`, la UI no renderiza nada con eso.
- Animaciones elaboradas.

## Verificación

- [ ] Tras elegir, se ven el texto de resultado y los eventos con glifo + texto; el HUD muestra los `delta`.
- [ ] Con un lector de pantalla (o inspeccionando el DOM) la región `aria-live` contiene el resumen del turno.
- [ ] Una decisión que termina la partida muestra "Ver final" y lleva a `/final`.
- [ ] Todo el flujo `card → outcome → card` se hace con teclado, con el foco donde corresponde.
- [ ] Test de `EventChip` (glifo + texto por tono) y de `OutcomePanel` (botón "Ver final" cuando `ended`).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`; sin hex.

## Handoff

Produce: ciclo de turno completo en la UI. Task 07 pule responsive, accesibilidad, movimiento y contraste.

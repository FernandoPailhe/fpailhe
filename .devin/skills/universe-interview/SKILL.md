---
name: universe-interview
description: >
  Entrevista estructurada al usuario para fijar las decisiones que definen la identidad narrativa,
  mecánica y estética de un universo (premisa, tono, tema moral, parámetros en tensión, etapas,
  elenco, amenazas, dirección de arte). Registra cada decisión en brief.md con su origen.
  Usar al empezar un universo, o para reabrir decisiones: "definamos el universo X",
  "preguntame lo importante de este juego", "cambiemos el tono del universo Y".
argument-hint: "<slug> [--express] [--round=1|2|3]"
triggers:
  - user
  - model
allowed-tools:
  - read
  - edit
  - grep
  - glob
  - exec
---

# Universe Interview

Conviertes una idea difusa en un **brief aprobado**. Eres el único punto de contacto con el usuario para las decisiones de identidad; los agentes posteriores no vuelven a preguntar lo que ya está en `brief.md`.

Lee primero: `references/question-bank.md` (preguntas, opciones y qué determina cada una) y `../create-universe/references/system-overview.md`.

## Principios

1. **Pregunta solo lo que cambia la identidad del universo.** Clasificación:
   - **Tier 1 — siempre se pregunta:** premisa y rol del jugador, tono, tema moral central, parámetros (qué hay en juego), cómo se gana/pierde, dirección estética (sensación, paleta, estilo), límites de contenido.
   - **Tier 2 — se propone un default y se pide confirmación** (en modo normal): cantidad de etapas, ramas, elenco, poderes y amenazas, duración, tipografía, estilo de íconos, idiomas.
   - **Tier 3 — se decide sin preguntar** y se registra como `supuesto`: nombres de claves, cantidades de cartas, distribución, detalles de magnitudes.
   En `--express` solo se hace Tier 1.
2. **Opciones concretas, no preguntas abiertas.** Cada pregunta lleva 2–4 opciones con una línea de consecuencia, la **recomendada primera** (con el motivo) y siempre admite respuesta libre. Usa la herramienta de preguntas con opciones si existe (agrupa hasta 4 preguntas por tanda); si no, numerá las opciones en el chat.
3. **Adapta el banco al tema.** No leas el banco como formulario: elige y reformula con el vocabulario del usuario. Si el tema permite proponer opciones más ricas con un vistazo rápido (1–2 búsquedas web de reconocimiento), hazlo antes de preguntar y di que son ideas de partida, no investigación.
4. **Tres rondas con resumen y confirmación**, no un interrogatorio continuo: (1) Narrativa, (2) Sistema, (3) Estética y límites. Al cerrar cada ronda resume en ≤ 8 líneas y pregunta "¿lo dejamos así?".
5. **Respeta lo que el usuario ya dijo.** Extrae del pedido original todo lo que responda preguntas del banco y confírmalo en vez de repreguntar.
6. **No empujes.** Si el usuario responde "lo que te parezca", toma la recomendada y márcala `default`.

## Procedimiento

1. Lee `brief.md`, `state.json` y **todo `doc/universes/<slug>/inputs/`** (documentos del usuario). Extrae de ellos las respuestas del banco que ya estén dadas y regístralas como decisiones con origen `usuario (inputs/<archivo>)`, confirmándolas en bloque en lugar de repreguntar. Si hay decisiones previas, retómalas (no repitas).
2. Extrae del §1 del brief las respuestas implícitas y arma la lista de preguntas pendientes por ronda según el modo.
3. Ronda 1 → registra. Ronda 2 → registra. Ronda 3 → registra. Tras cada respuesta, añade una fila al log del brief §2 (`D-xx`, ronda, pregunta, decisión, **origen** = `usuario` | `default` | `supuesto`, qué determina) y completa la sección correspondiente (§3–§6).
4. **Coherencia cruzada** antes de cerrar: ¿los parámetros elegidos expresan el tema moral? ¿hay al menos 2 pares claramente en tensión? ¿la dureza es compatible con la duración? ¿la estética sostiene el tono? Si algo choca, plantéalo como pregunta, no lo resuelvas en silencio.
5. **Términos bloqueados:** pide al usuario las obras/marcas/artistas que sirven de referencia pero **no** deben aparecer, y vuélcalos a `blocked-terms.txt` (uno por línea). Recuérdale que las referencias se usan como inspiración descriptiva, nunca nombradas en el juego.
6. **Cierre:** presenta el resumen final (premisa, tono, tema moral, parámetros + pares en tensión, etapas, elenco, estética, límites, supuestos) y pide aprobación. Con la aprobación: `set-phase.mjs <slug> interview done "brief aprobado"`.

## Salida esperada de `brief.md`

- §2 sin filas vacías; todas las decisiones Tier 1 con origen `usuario` o `default`.
- §3–§6 completos; §8 con las preguntas abiertas que quedan (y qué fase las necesita).
- `blocked-terms.txt` poblado si el usuario dio referencias protegidas.

## Errores comunes

- Preguntar 15 cosas seguidas → agrupar y limitar.
- Dar opciones que son en realidad la misma → hacerlas distintas en consecuencia.
- Dejar parámetros como "recursos, felicidad, poder" genéricos → cada parámetro debe nacer del tema moral (qué valores se disputan).
- Aceptar un tono contradictorio con los límites de contenido → resolverlo ahora.

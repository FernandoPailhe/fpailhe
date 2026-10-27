---
name: generate-situation-cards
description: >
  Genera lotes de cartas de situación (SituationCard) de un universo a partir de una rebanada del
  content-plan, respetando la biblia, la tension-spec y la guía de escritura. Escribe un JSON por
  carta en cards/NNN-slug.json y se autovalida con check-tensions y lint-content.
  Usar para producir contenido: "generá las cartas de la slice s02", "escribí cartas del universo X
  para la etapa 2", o desde universe-batch.
argument-hint: "<slug> --slice=<id> | --range=<desde>-<hasta> [--batch] [--dry-run]"
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

# Generate Situation Cards

Produces cartas listas para publicar, por defecto de a una y consultándolas con el usuario (ver Modos de trabajo). Lee **siempre**, en este orden: la slice de `content-plan.json`, `universe-bible.md` (§3 actores, §4 sistema, §5 tensiones, §6 escritura, §8 glosario, §9 canon), `tension-spec.json`, `references/card-writing-guide.md` y `references/card-template.json`. No leas ni uses `research/` para escribir: ya está destilado en la biblia.

## Entradas
`<slug>` y la slice (por `--slice=id`) o un rango de numeración. Si no hay plan, detente y pide ejecutar `plan-universe-content`.

## Modos de trabajo

- **Interactivo (por defecto): carta por carta, en el chat.** Lo conduce la sesión principal con el usuario (los subagentes no hablan con él). Para cada carta de la slice, en orden:
  1. Presenta la **ficha**: número, personaje, **rol de la carta en la narración general** (qué aporta a la historia, etapa o arco, qué tensión mueve), arquetipo, par de tensión y dificultad.
  2. Propone el **texto** y las **opciones** (label + outcomeText) y explica en lenguaje llano **cómo afecta cada opción a los parámetros** (ej. «Pueblo +8, Tesoro −6») y qué valor protege cada una. Los números se muestran en el chat aunque no vayan en el texto de la carta.
  3. **Consulta** texto, respuestas y efectos. No escribas el archivo hasta que el usuario apruebe o indique cambios.
  4. Con su OK: escribe `cards/NNN-….json`, valida (paso 6 del procedimiento) y pasa a la siguiente.
  5. Tras **cada corrección del usuario**, evalúa si hay que actualizar el brief, la biblia (§12), la `tension-spec.json`, el glosario o el canon, y dilo (propón o aplica según su aprobación).
  Reglas: (a) las palabras que escribe el usuario se dejan **tal cual** (grafía, mayúsculas, signos), aunque parezcan errores; se pregunta antes de cambiarlas. (b) Si el hecho de la situación **ya ocurrió**, las opciones son posturas o reacciones del protagonista; los pedidos de acción van en otra carta. (c) No todas las cartas llevan 3 opciones: 2 es válido (1 para eventos obligatorios).
- **Lote (`--batch`):** producción por agentes `card-writer`, una slice por agente, sin consulta carta por carta. Solo si el usuario lo pidió o aprobó explícitamente; igualmente se revisa una muestra con él. El procedimiento de abajo describe el lote y es la base técnica del modo interactivo (mismos archivos, ids y validaciones).

## Procedimiento

1. **Cargar contexto** (ver arriba) y listar las cartas ya existentes del rango (no sobrescribir salvo `--force` del orquestador; si el rango tiene archivos, continúa desde el primer hueco).
2. **Diseñar antes de escribir.** Para cada carta de la slice produce una **ficha** de una línea: `NNN · personaje · arquetipo · par de tensión · dificultad · nº de opciones · qué valor protege cada opción`. Revisa la ficha de toda la slice por variedad (arquetipos, personajes, longitudes, nº de opciones) y por dificultad creciente. No escribas aún.
3. **Escribir cada carta** con `card-template.json`:
   - `text` en el idioma base, en la voz del §6, **sin nombrar parámetros ni números**; la tensión se siente, no se explica.
   - 1–3 opciones. Cada opción estándar: `label` (acción concreta, ≤ `maxLabelChars`), `outcomeText` (consecuencia narrativa, ≤ `maxOutcomeChars`), `effects` con `modify_parameter` (deltas dentro de la escala de magnitudes y el presupuesto de dificultad), y el resto de efectos solo si la biblia lo prevé (`grant_power`, `enqueue_card`, `award_badge`, `set_flag`…).
   - Opción de equilibrio (`kind: "balance"`): solo donde el plan lo indique, con `unlockTag`, `availability` y `whenUnavailable`.
   - `threatTags` en las opciones cuyo resultado representa una amenaza (del vocabulario de la spec).
   - `availability` (etapas, ramas, condiciones), `recurrence`, `baseWeight` (1 por defecto), `themeTags` (incluye los del personaje).
4. **Nombre de archivo y ids:** `cards/NNN-slug-corto.json`; carta `off_card_NNN`; opciones `off_card_NNN_o1…o3`; `gameId` del juego; `characterId` válido; `assetId` omitido (lo gestiona estética).
5. **Cadenas:** si usas `enqueue_card` o `card_seen`, la carta destino debe existir en la misma slice o estar listada en el plan; verifica ids.
6. **Autovalidación** (obligatoria, repetir hasta pasar):
   ```
   node .devin/skills/universe-qa/scripts/lint-content.mjs <slug>
   node .devin/skills/universe-qa/scripts/check-tensions.mjs <slug>
   ```
   Corrige errores. De los avisos, corrige los que afecten a tus cartas (W-DOMINATED, W-DELTA-NOISE, W-NO-PARAM-EFFECT, W-KEY-LEAK, W-TEXT-LONG); los avisos globales (W-BIAS, W-QUOTA-*) los atiende `balance-auditor`.
7. **Prueba de dilema** (checklist §5.9 de la biblia) sobre cada carta: si falla, rediseña la carta, no maquilles el texto.
8. **Reporte** al orquestador (≤ 25 líneas): cartas creadas (rango), distribución (opciones, dificultades, personajes, pares), supuestos tomados, canon nuevo propuesto (para que `lorekeeper` lo registre), y **Preguntas para el usuario**.

## Reglas duras

- Solo escribes dentro de `apps/web/src/lab/universes/content/<slug>/cards/` y solo los archivos de tu rango.
- No modificas parámetros, personajes ni poderes: si falta algo, propónlo en el reporte.
- Nada de términos de `blocked-terms.txt`, nombres reales de obras/marcas/personas, ni claves internas en los textos.
- Cada carta debe poder jugarse sola: no depende de que el jugador recuerde texto de otra, salvo la cadena declarada.
- `--dry-run`: solo produce las fichas del paso 2 y no escribe archivos.

## Calidad mínima por carta
- Dos jugadores razonables elegirían opciones distintas.
- El costo de cada opción es deducible desde el texto.
- La voz del personaje es reconocible sin ver el nombre.
- El `outcomeText` cierra la escena en 1–2 oraciones y no moraliza.

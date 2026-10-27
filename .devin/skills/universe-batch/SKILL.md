---
name: universe-batch
description: >
  Producción masiva de universos: toma una lista de ideas/temas, los pone en cola, crea cada
  universo, agrupa las preguntas al usuario por tandas (para entrevistar varios universos de una
  vez) y avanza las fases que no necesitan al usuario en paralelo. Mantiene el tablero
  doc/universes/_index.md. Usar para volumen: "armá 5 universos: A, B, C…", "retomá el lote",
  "¿en qué estado está cada universo?".
argument-hint: "<archivo-lista.md | 'tema1; tema2; …'> [--express] [--max-parallel=3]"
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

# Universe Batch

Orquesta **varios** universos a la vez con `create-universe` como motor de cada uno. La clave es separar el trabajo que **necesita al usuario** (entrevista, elección de paleta, aprobación de biblia) del que **no** (investigación, redacción, cartas, traducción, QA), y no bloquear lo segundo esperando lo primero.

## Entrada
Lista de universos, cada uno con al menos un tema; opcional: slug, nombre, idiomas, notas. Formato de archivo (`doc/universes/_batch.md`):

```
- slug: faraon-ciudad | nombre: La Ciudad del Faraón | idea: administrar una ciudad del Nilo | locales: es,en
- idea: una expedición polar con víveres escasos
```
Si falta slug/nombre, propónlos (slug: minúsculas, números y guiones, 2–41 caracteres; confirmar en la primera tanda de preguntas).

## Procedimiento

1. **Normalizar y deduplicar.** Crea o actualiza `doc/universes/_batch.md` con la cola (estado por universo). Detecta temas casi idénticos y pregúntalo.
2. **Scaffold de todos** los universos nuevos (`scaffold.mjs`). Si ya existen, retómalos (no sobrescribir).
3. **Entrevistas agrupadas.** Ejecuta `universe-interview` para cada universo en **una sola sesión de preguntas con el usuario**, por rondas: primero la Ronda 1 de todos los universos, luego la 2, luego la 3. Reglas:
   - `--express` recomendado en lote: solo Tier 1; el resto queda como `default`/`supuesto` en cada brief.
   - Reutiliza decisiones: si varios universos comparten límites de contenido o idioma, pregúntalo una vez y aplícalo a todos (registrado como `D-xx` con origen `usuario`).
   - Máximo 4 preguntas por tanda, siempre indicando **a qué universo** se refieren.
4. **Pipeline en paralelo (sin usuario).** En cuanto un brief esté aprobado, dispara su `research` → `bible` (borrador) → `tensions` en segundo plano. Respeta `--max-parallel` universos simultáneos y el tope de ~4–5 agentes por universo.
5. **Compuertas de usuario agrupadas.** Cuando varios universos llegan a la misma compuerta, preséntalas juntas:
   - hallazgos de investigación (1 resumen por universo),
   - aprobación de biblia (1 página por universo, en orden de prioridad),
   - elección de estética (direcciones por universo).
   Mientras tanto, los universos que ya pasaron su compuerta avanzan (`entities`, `plan`, `cards`, `localization`, `qa`).
6. **Tablero.** Tras cada transición: `node .devin/skills/create-universe/scripts/status.mjs --write`. Ofrece al usuario el resumen en tabla (universo · fase actual · cartas escritas/planeadas · bloqueos · pendiente del usuario).
7. **Fallos aislados.** Un universo `blocked` no detiene a los demás: se anota el motivo en el tablero y se continúa.
8. **Cierre del lote.** Para cada universo `qa: done`, reporta veredicto y rutas. Lista lo que queda para el usuario (aprobaciones pendientes, imágenes por producir, validador multi-universo).

## Reglas
- Un universo no hereda canon de otro (cada biblia es independiente) salvo que el usuario pida un "multiverso" explícito.
- Slugs únicos; nunca reutilizar el nombre de un universo ya publicado.
- Los límites de PI y de contenido aplican por universo: `blocked-terms.txt` propio.
- El orquestador es el único que escribe `state.json`, `_index.md` y `_batch.md`.
- No lanzar generación masiva de cartas (fase 8) de un universo cuya biblia no esté aprobada.

## Estimación de costo para el usuario
La fase `cards` es **interactiva carta por carta** salvo que el usuario elija el modo lote (`--batch`) para ese universo: propónlo y espera su confirmación. Antes de la fase `cards`, informa por universo: slices × cartas, agentes en paralelo y tiempo orientativo, y pregunta si se procede o se recorta el alcance (cantidad de cartas, idiomas).

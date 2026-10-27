---
name: create-universe
description: >
  Orquesta la creación de un universo de juego completo (entrevista, investigación web, biblia,
  sistema de tensiones, entidades, estética, cartas, traducciones y QA) para la plataforma Narratives.
  Es el punto de entrada: crea el esqueleto, ejecuta o reanuda las fases en orden, consulta al usuario
  las decisiones de narrativa y estética y delega el trabajo masivo a los agentes del sistema.
  Usar para "creá un universo de X", "armá un juego sobre Y", "continuá el universo Z",
  "¿cómo va el universo W?".
argument-hint: '<slug> "<Nombre>" [tema o idea] [--express]'
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

# Create Universe

Eres el **orquestador** de un universo. No escribes todo tú: guías las fases, hablas con el usuario en las compuertas y delegas el trabajo en paralelo a los agentes. Antes de empezar lee `references/system-overview.md` (carpetas, fases, ids, reglas transversales).

## 1. Arranque o reanudación

1. Si el universo **no existe** (`doc/universes/<slug>/state.json`), crea el esqueleto:
   `node .devin/skills/create-universe/scripts/scaffold.mjs <slug> "<Nombre>" [--locales=es,en]`.
   Valida el slug (minúsculas, números, guiones). Guarda el pedido textual del usuario en `brief.md` §1.
   Dile al usuario que puede dejar documentos `.md` (ideas, lore, reglas, notas de estética) en `doc/universes/<slug>/inputs/` en cualquier momento; los skills los leen antes de preguntar o investigar. Si ya los adjuntó en el chat, guárdalos ahí como `.md`.
2. Si **existe**, lee `state.json` y `node .devin/skills/create-universe/scripts/status.mjs <slug>`: reanuda en la primera fase que no esté `done`. No rehagas fases aprobadas salvo que el usuario lo pida.
3. Modo: **normal** (por defecto: consulta todas las decisiones Tier 1 y 2) o **`--express`** (solo Tier 1; el resto se toma por defecto y queda como `supuesto` en el brief y en el §11 de la biblia). Dilo al usuario al empezar.

## 2. Ejecutar las fases

Para cada fase: marca `in_progress` (`set-phase.mjs`), invoca el skill indicado, verifica las salidas, pasa la compuerta y marca `done`.

| Fase | Skill a invocar | Salidas que debes verificar | Compuerta |
| --- | --- | --- | --- |
| `interview` | `universe-interview` | `brief.md` completo, log de decisiones sin huecos Tier 1, `blocked-terms.txt` | El usuario aprueba el resumen del brief |
| `research` | `universe-research` | `research/00-plan.md`, ≥ 5 dossiers, `sources.md`, `dilemma-seeds.md` | Presentas 5–8 hallazgos clave y el usuario confirma qué conservar/descartar |
| `bible` | `universe-bible` | `universe-bible.md` con §1–4, 6–9 completos | Revisión interna (sin `<!-- -->` pendientes) |
| `tensions` | `design-tension-system` | §5 de la biblia + `tension-spec.json` | Presentas un resumen (matriz, tiers, economía de escudos) y el usuario **aprueba la biblia**: `status: approved`, `version: 1` |
| `entities` | `design-universe-entities` | JSON de entidades; `lint-content` sin errores | Automática |
| `plan` | `plan-universe-content` | `content-plan.json` | Automática (rangos sin solaparse) |
| `aesthetics` | `design-universe-aesthetics` | `aesthetic.json`, `icons.json`, `aesthetic-notes.md`; `check-contrast` sin errores | El usuario elige entre 2–3 paletas propuestas |
| `cards` | `generate-situation-cards` | Cartas de todos los slices; `check-tensions` y `lint-content` sin errores | Automática |
| `localization` | `localize-universe` | Traducciones en todos los idiomas del brief | Automática |
| `qa` | `universe-qa` | `qa-report.md` limpio | Resumen final al usuario |

Reglas de orquestación:
- **Paralelismo:** investigación (un `universe-researcher` por tema), cartas (un `card-writer` por slice) y traducción (un `localizer` por idioma). Máximo 4–5 agentes simultáneos por universo. Dales el slug, sus rutas exclusivas y los archivos que deben leer.
- **Nada de preguntas en subagentes.** Recoge sus "Preguntas para el usuario" y formúlalas tú, agrupadas (máx. 4 por tanda).
- **Fallos:** si una compuerta automática falla, devuelve el trabajo al agente con la lista de errores (máx. 3 iteraciones); si persiste, marca la fase `blocked` con una nota y avisa al usuario.
- **Cambios tras aprobar la biblia:** pasan por su §12 (qué cambia, versión, impacto en contenido). Incrementa `bibleVersion` con `set-phase.mjs … --bible-version=N`.
- Al terminar cada fase informa en 2–3 líneas qué quedó hecho y qué viene. No pegues documentos enteros en el chat: referencia rutas.

## 3. Cierre

Cuando `qa` esté `done`: ejecuta `status.mjs --write`, y resume al usuario: nombre y logline del universo, parámetros y su matriz de tensiones en una línea, cantidad de cartas por etapa, idiomas, supuestos pendientes de revisar y qué falta del lado humano (producir imágenes/íconos con las plantillas de `aesthetic-notes.md`, registrar el juego en el cargador de la app, revisar contenido sensible).

## Cómo se trabaja con el usuario (siempre)

Las reglas permanentes están en `doc/universes/README.md`: cartas de a una en el chat (el lote es opt-in), palabras del usuario tal cual, evaluar la documentación tras cada corrección, y decisiones importantes siempre consultadas.

## Qué NO hacer

- No inventes decisiones Tier 1 (ver `universe-interview`): pregunta.
- No saltes la compuerta de la biblia: sin aprobación no se generan entidades ni cartas.
- No toques archivos de otros universos ni `_index.md` desde un subagente.
- No marques una fase `done` con errores de los scripts de verificación.

---
name: design-universe-entities
description: >
  Define las entidades estructurales del universo y genera sus JSON: game, stages, branches,
  parameters (con umbrales), characters (ayudantes y antagonistas), powers (escudos y modificadores),
  badges, icons y assets. Todo derivado de la biblia y la tension-spec. Usar tras aprobar la biblia:
  "creá los personajes y poderes del universo X", "generá los parámetros y etapas".
argument-hint: "<slug> [--only=game,stages,branches,parameters,characters,powers,badges]"
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

# Design Universe Entities

Traduces la biblia (§3, §4) en los archivos JSON de `apps/web/src/lab/universes/content/<slug>/`. **No inventas canon**: si falta algo, vuelve a la biblia (control de cambios) o pregunta. Lee `references/entity-templates.md` y los modelos en `doc/specs/lab/universes/narrative-game-models.ts`.

## Orden de generación (dependencias)

1. `game.json` → 2. `stages.json` → 3. `branches.json` → 4. `parameters.json` (+ umbrales) → 5. `characters.json` → 6. `powers.json` → 7. `badges.json` → 8. `icons.json` / `assets.json` (placeholders; los completa `design-universe-aesthetics`).

Cada archivo es un array (o objeto para `game.json`) con los campos de los modelos. Usa los ids y convenciones de `system-overview.md` (`off_*`, claves `snake_case`).

## Reglas por entidad

- **Game:** `kind`, `title`/`description` (LocalizedText), `defaultLocale`, `supportedLocales`, `aestheticId`, `visibility`, `config` (`recentCardsWindow`, `initialActiveParameterIds`, `initialUnlockedCharacterIds`, `initialBranchIds`, `initialPowers`, `allowCardFeedback`).
- **Stages:** `order` consecutivo desde 1; `name`, `minScore` creciente, `activatesParameterIds` (nuevos parámetros por etapa), `difficultyRange {min,max}`, `onEnter` opcional. Coinciden con el §4.3 y con `quotas.byStageOrder`.
- **Branches:** `exclusiveGroup` si son excluyentes; cómo se entra (tag/efecto) y qué etapas cubre.
- **Parameters:** `key`, `min/max/initialValue`, `description` con el significado de 0 y 100, `iconId`, `thresholds[]` (`off_thr_*`, `comparator` lte/gte, `value`, `effects`, `threatTags`, `once`): extremos (final o insignia) y un umbral previo que avise (p. ej. `enqueue_card` de advertencia). El conjunto de claves **debe igualar** `tension-spec.parameters`.
- **Characters:** `name`, `title` (función: aliado, rival, consejero, voz colectiva), `themeTags` (las cartas con esos tags pueden asignársele), `unlockedByDefault` / `unlockCondition`. La voz y los tics (§6) viven en la biblia, no en el JSON. Sin personas reales ni personajes protegidos.
- **Powers:** unión por `kind`: `shield` (`blocksThreatTags`), `option_unlock` (`unlocksOptionTag`), `modifier` (`parameterId`, `multiplier`, `appliesTo`); `maxCharges`. Cómo se obtiene (`grant_power` en qué opción/umbral) y su costo de oportunidad. Cada `threatTag` de la spec debe tener ≥ 1 escudo; cada poder, un uso real en el plan.
- **Badges:** `rarity`; reconocen patrones de juego (no solo resultados). Se otorgan con `award_badge` desde opciones/umbrales: documentar en la biblia qué patrón las dispara.
- **Textos:** localizados en el idioma base (y `requiredLocales` si ya existen); respetar límites de longitud y la guía de escritura.

## Procedimiento

1. Lee biblia §3, §4, §6 y la spec. Lista las entidades por crear con su id.
2. Genera los JSON (ver plantillas). Para volumen (≥ 6 personajes o ≥ 6 poderes) delega a `systems-designer` por grupos, con las rutas de salida y sin solapes.
3. Valida: `node .devin/skills/universe-qa/scripts/lint-content.mjs <slug>` (ids, textos, estado) y chequea cruzado: claves de parámetros ↔ spec; `threatTags` ↔ powers; `exclusiveGroup`; `stageOrder` ↔ cuotas.
4. Reporta al orquestador: entidades creadas, supuestos, y **preguntas para el usuario** (p. ej. nombres propios con carga cultural).
5. `set-phase.mjs <slug> entities done`.

## Calidad

- Cada personaje puede **sostener ≥ 3 cartas distintas** (no es decorado).
- Cada poder cambia una decisión real (si desaparece, alguna carta se vuelve peor).
- Ningún parámetro sin umbral de advertencia.
- Nombres que no colisionen con `blocked-terms.txt`.

# Plantillas de entidades

Fuente de verdad: `doc/specs/lab/universes/narrative-game-models.ts`. Estas plantillas muestran la **forma mínima válida**.

Convenciones comunes:
- Toda entidad: `id`, `schemaVersion: 1`, `createdAt`, `updatedAt` (ISO 8601; usar la fecha actual), y si es del juego, `gameId`.
- `LocalizedText` = `{ "default": "texto en el idioma base", "translations": { "en": "…" } }`. `translations` se completa en la fase `localization` (puede omitirse antes).
- Ids: `off_<tipo>_<key>`; claves (`key`) en `snake_case`.
- Solo **Game** y **SituationCard**/**MediaAsset** son `Authored`: llevan `createdBy: "system"`, `origin: "official"`, `status: "published"`.

## game.json
```json
{
  "id": "off_<slug_con_guiones_bajos>", "schemaVersion": 1,
  "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z",
  "createdBy": "system", "origin": "official", "status": "draft",
  "slug": "<slug>", "kind": "<tipo_de_juego>",
  "title": { "default": "" }, "description": { "default": "" },
  "defaultLocale": "es", "supportedLocales": ["es"],
  "aestheticId": "off_aesthetic_<slug_con_guiones_bajos>",
  "visibility": "public",
  "config": {
    "recentCardsWindow": 6,
    "initialActiveParameterIds": ["off_param_<k1>", "off_param_<k2>"],
    "initialUnlockedCharacterIds": ["off_char_<k>"],
    "initialBranchIds": [],
    "initialPowers": [],
    "allowCardFeedback": true
  },
  "metadata": {
    "endings": {
      "<endingKey>": { "title": { "default": "" }, "text": { "default": "" } }
    }
  }
}
```
Todo `endingKey` usado en `end_game` (y `no_cards`) debe tener entrada en `metadata.endings`; publicar = cambiar `status` a `published` a mano (ver `doc/universes/README.md` § "Publicar un universo").

## stages.json (elemento)
```json
{
  "id": "off_stage_1", "gameId": "off_<slug>", "schemaVersion": 1, "createdAt": "…", "updatedAt": "…",
  "order": 1, "name": { "default": "" },
  "minScore": 0,
  "activatesParameterIds": ["off_param_<k3>"],
  "onEnter": [],
  "difficultyRange": { "min": 1, "max": 3 }
}
```
`enterConditions` (opcional) usa el motor de `Condition`. `minScore` crece por etapa.

## branches.json (elemento)
```json
{
  "id": "off_branch_<key>", "gameId": "off_<slug>", "schemaVersion": 1, "createdAt": "…", "updatedAt": "…",
  "key": "<key>", "name": { "default": "" }, "description": { "default": "" },
  "exclusiveGroup": "<grupo>"
}
```

## parameters.json (elemento)
```json
{
  "id": "off_param_<key>", "gameId": "off_<slug>", "schemaVersion": 1, "createdAt": "…", "updatedAt": "…",
  "key": "<key>", "name": { "default": "" }, "description": { "default": "0 = …, 100 = …" },
  "iconId": "off_icon_<key>",
  "min": 0, "max": 100, "initialValue": 50,
  "thresholds": [
    { "id": "off_thr_<key>_low", "comparator": "lte", "value": 0,
      "threatTags": ["<amenaza>"],
      "effects": [ { "type": "end_game", "outcome": "defeat", "endingKey": "<key>_collapse", "threatTags": ["<amenaza>"] } ] },
    { "id": "off_thr_<key>_high", "comparator": "gte", "value": 100, "once": true,
      "effects": [ { "type": "award_badge", "badgeId": "off_badge_<key>" } ] }
  ]
}
```
Los extremos suelen terminar la partida (`end_game`) o dar una insignia. Los avisos previos (por ejemplo `lte 20`) pueden `enqueue_card` una carta de advertencia. `threatTags` permite que un escudo intercepte ese umbral.

## characters.json (elemento)
```json
{
  "id": "off_char_<key>", "gameId": "off_<slug>", "schemaVersion": 1, "createdAt": "…", "updatedAt": "…",
  "key": "<key>", "name": { "default": "" }, "title": { "default": "" },
  "portraitAssetId": "off_asset_<key>_portrait",
  "themeTags": ["<tag1>", "<tag2>"],
  "unlockedByDefault": true
}
```
Para desbloqueo tardío: `unlockedByDefault: false` y `unlockCondition` (`Condition`) o un efecto `unlock_character`.

## powers.json (elemento) — uniones por `kind`
```json
{ "id": "off_power_<key>", "gameId": "off_<slug>", "schemaVersion": 1, "createdAt": "…", "updatedAt": "…",
  "key": "<key>", "name": { "default": "" }, "description": { "default": "" }, "iconId": "off_icon_<key>",
  "maxCharges": 2,
  "kind": "shield", "blocksThreatTags": ["<amenaza>"] }
```
```json
{ "…": "…", "kind": "option_unlock", "unlocksOptionTag": "<tag_de_opcion_balance>" }
```
```json
{ "…": "…", "kind": "modifier", "parameterId": "off_param_<key>", "multiplier": 1.2, "appliesTo": "positive" }
```
Los poderes se otorgan con `grant_power` en efectos de opciones o de umbrales/insignias; también pueden iniciar en `config.initialPowers`.

## badges.json (elemento)
```json
{ "id": "off_badge_<key>", "gameId": "off_<slug>", "schemaVersion": 1, "createdAt": "…", "updatedAt": "…",
  "key": "<key>", "name": { "default": "" }, "description": { "default": "" },
  "iconId": "off_icon_<key>", "rarity": "common" }
```
Se otorgan con el efecto `award_badge`; la condición vive en el efecto/umbral que las otorga, no en la insignia.

## icons.json / assets.json
Placeholders aquí; los completa `design-universe-aesthetics`. Icon: `{ id, gameId, key, label, semanticTags, svg? | assetId? , … }` (`label` = `LocalizedText` para accesibilidad).

> Si algo difiere de `narrative-game-models.ts`, **gana el modelo**: corregir esta plantilla y avisar al orquestador.

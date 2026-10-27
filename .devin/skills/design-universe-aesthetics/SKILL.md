---
name: design-universe-aesthetics
description: >
  Define la estética completa de un universo (AestheticProfile): dirección de arte con prompts base
  y plantillas por tipo de asset, tokens de color claro/oscuro con contraste verificado, tipografía,
  estilo de íconos, movimiento y overrides por rama/etapa; genera aesthetic.json, icons.json,
  assets.json (con prompts) y aesthetic-notes.md. Consulta al usuario la dirección visual.
  Usar tras la biblia: "definí la estética del universo X", "armá los prompts de arte",
  "cambiemos la paleta".
argument-hint: "<slug> [--prompts-only] [--revise]"
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

# Design Universe Aesthetics

Una estética es **un contrato visual reproducible**: cualquier persona o modelo que lea `aesthetic.json` debe poder generar un asset coherente con el resto. Modelo: `AestheticProfile` (§9 de `narrative-game-models.ts`) y `doc/specs/lab/universes/narratives-aesthetics.md`.

Insumos: biblia §7 (resumen estético), `brief.md` §5 (decisiones Ronda 3), `inputs/*` (referencias visuales o notas de estilo del usuario), `research/visual-notes.md`, `blocked-terms.txt`.

## Dinámica con el usuario (obligatoria)

1. Si el brief ya fija sensación, paleta y estilo (Tier 1), **no repreguntes**: propone el desarrollo y confirma.
2. Presenta **2–3 direcciones completas** (descripción en palabras + muestras hex de la paleta + carácter tipográfico + estilo de íconos + 1 prompt de ejemplo) y la recomendada con motivo. Pide elegir o mezclar. Registra la decisión como `D-xx` en el brief.
3. Tras generar prompts, pide revisar **1 carta ilustrada de ejemplo** (el prompt de `card_illustration` ya resuelto con un sujeto real del universo) y **1 retrato**. Ajusta `basePrompt` si algo no representa lo buscado.

## Procedimiento

1. **Dirección de arte (`artDirection`).** `styleSummary` humano; `basePrompt` (técnica, medio, iluminación, época, composición — **sin nombres de artistas, obras ni marcas**, solo atributos); `negativePrompt` (incluye texto legible, logos, marcas de agua, anatomía rota, estilos a evitar); `keywords`, `mood`, `paletteHint`; `templates` por propósito (`card_illustration`, `character_portrait`, `icon`, `badge`, `cover`, `background`, y `video`/`animation` si el brief lo pide) con `aspectRatio`, `size` y placeholders `{{base}} {{subject}} {{character}} {{mood}} {{palette}} {{negative}}`; `consistencyRules` (encuadre, fondo, iluminación, qué evitar); `recommendedModel` opcional.
2. **Tokens.** `defaultScheme`, `light` y `dark` (ColorScheme completos: 13 colores), `parameterColors` (un color distinto por parámetro, legible sobre `surface`, y distinguibles entre sí también para daltonismo: variar luminosidad, no solo tono), `radius`, `borderWidth`, `spacingUnit`, `shadows`, `motion` (duraciones, `easing`, `cardTransition`).
3. **Tipografía.** `fonts.display` y `body` (+ `accent` opcional) con `source`, `weights`, `subsets` (incluye `latin-ext` si hay tildes/otros idiomas), `fallback`; `google` por defecto (gratuitas y con licencia abierta); `self_hosted` solo con `license`. Escala (`title`, `cardText`, `option`, `label`, `number`, `caption`) legible en móvil: `cardText` ≥ 16 px, `option` ≥ 15 px, interlineado ≥ 1.4. `localeOverrides` si algún idioma necesita otra fuente.
4. **Íconos (`iconStyle`).** `variant`, `gridSize`, `strokeWidth`, `corners`, `format`, `colorMode`, `generationNotes`. Luego `icons.json`: un ícono por parámetro, poder, insignia y estado (`danger`, `locked`) donde corresponda, con `key`, `label` (accesible), `semanticTags`. Para SVG simples puedes escribir `svg` inline coherente con el estilo; si no, deja `assetId` con su asset.
5. **Assets.** `assets.json`: un asset por retrato de personaje, portada del juego, 3–5 fondos y las ilustraciones de cartas clave. Cada uno con `generation.purpose`, `aestheticId`, `aestheticVersion`, y el **prompt ya resuelto** con las plantillas (`url` vacío hasta producirlo, `source: "ai"`). No inventes URLs.
6. **Overrides.** `overrides[]` por rama o etapa (`when: Condition`) con colores parciales, `artDirectionAppend` y/o `cardTransition`, solo donde la biblia lo justifique.
7. **Validar:**
   ```
   node .devin/skills/design-universe-aesthetics/scripts/check-contrast.mjs <slug>
   node .devin/skills/universe-qa/scripts/lint-content.mjs <slug>
   ```
   Contraste: texto normal ≥ 4.5:1, texto grande y elementos de UI ≥ 3:1, en claro y oscuro. Ajusta tokens hasta pasar.
8. **`aesthetic-notes.md`:** resumen de la dirección elegida, lista de assets por producir con su prompt, guía de revisión de imágenes (qué rechazar), y notas de licencias de fuentes.
9. `set-phase.mjs <slug> aesthetics done`.

## Reglas

- **Cero PI:** ni artistas, ni obras, ni marcas, ni personajes en prompts, keywords o nombres de tokens. Describir por atributos (técnica, época, materiales, paleta, composición).
- Los prompts deben ser **independientes del modelo de generación** salvo `recommendedModel`.
- Accesibilidad primero: el significado nunca depende solo del color; hay `label` en cada ícono.
- Versiona: cada cambio relevante incrementa `version` y los assets guardan con cuál se generaron.
- Escribes solo `aesthetic.json`, `icons.json`, `assets.json` y `aesthetic-notes.md` del universo.

## Preguntas para el usuario (devolver si no están resueltas)
Dirección entre las propuestas · modo claro/oscuro por defecto · si habrá video/animación · herramienta de generación de imágenes disponible · restricciones de marca.

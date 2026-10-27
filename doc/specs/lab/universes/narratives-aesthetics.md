# Narratives — Spec de estética por juego

> Documento complementario de `narratives-init.md`, destinado a un agente de implementación.
> **Fuente de verdad de los tipos:** `narrative-game-models.ts`, sección `§9 Estética` (más los campos `Game.aestheticId`, `Parameter.iconId`, `Power.iconId`, `Badge.iconId` y `MediaAsset.generation`).
> Este spec no redefine tipos: los importa.

---

## 1. Objetivo

Que **cada juego tenga su propia identidad visual** (estilo de ilustración, paleta, tipografías, íconos, movimiento) definida **como datos**, no como código. Con esos datos:

1. Se **generan imágenes** consistentes (prompts derivados de una dirección de arte).
2. La **UI se tematiza** automáticamente (colores, fuentes, formas, animaciones).
3. Los **parámetros se comunican con íconos** en lugar de texto.
4. Se pueden **regenerar o auditar assets** cuando la estética cambia.

Un juego nuevo debe poder tener un look completamente distinto **sin tocar componentes React ni el motor**.

---

## 2. Principios

1. **Estética = datos.** Un `AestheticProfile` por juego (`§9`), referenciado por `Game.aestheticId`.
2. **Una sola fuente para prompts y UI.** La paleta que describe el prompt (`paletteHint`) y la que usa la UI (`tokens`) deben ser coherentes; se definen juntas.
3. **Trazabilidad.** Todo asset generado guarda cómo se hizo (`AssetGeneration`), con la `aestheticVersion` vigente.
4. **Degradación elegante.** Si falta un ícono, una imagen o una fuente, el juego sigue funcionando (ver §9).
5. **Accesibilidad no negociable.** Contraste, no depender solo del color, íconos con etiqueta textual accesible, respeto de `prefers-reduced-motion`.
6. **Separación de capas.** La estética nunca contiene reglas de juego; las reglas nunca contienen estilos.

---

## 3. Modelo de datos (referencias a `§9`)

| Concepto | Tipo | Qué resuelve |
|---|---|---|
| Perfil estético | `AestheticProfile` | Contenedor versionado de todo lo estético de un juego |
| Dirección de arte | `ArtDirection`, `PromptTemplate` | Prompts base, negativos, palabras clave, plantillas por tipo de asset |
| Trazabilidad | `AssetGeneration` (en `MediaAsset.generation`) | Cómo, cuándo y con qué versión se creó cada asset |
| Colores y forma | `DesignTokens`, `ColorScheme` | Paleta semántica claro/oscuro, radios, sombras, movimiento |
| Tipografía | `Typography`, `FontFace`, `TypeStyle` | 2–3 fuentes por rol y escala tipográfica |
| Íconos | `IconStyle`, `Icon` | Estilo consistente y biblioteca de íconos del juego |
| Variaciones | `ThemeOverride` | Cambios por rama o etapa usando `Condition` (`§3`) |

Relaciones:
- `Game.aestheticId` → `AestheticProfile.id`.
- `Parameter.iconId`, `Power.iconId`, `Badge.iconId` → `Icon.id`.
- `Icon.assetId` y `MediaAsset` → archivos; `MediaAsset.generation.aestheticId/aestheticVersion` → perfil.
- `DesignTokens.parameterColors` → `Parameter.id`.

---

## 4. Dirección de arte y generación de imágenes

### 4.1 Composición del prompt
El prompt final de cualquier imagen se arma **siempre** con una función pura `composePrompt()` en este orden:

```
plantilla del propósito (templates[purpose].template)
  ← {{base}}    = artDirection.basePrompt (+ overrides[].artDirectionAppend aplicables)
  ← {{subject}} = descripción específica de la carta/ícono/personaje
  ← {{character}} = descripción del personaje (si aplica, ver §4.3)
  ← {{mood}}    = artDirection.mood (unido)
  ← {{palette}} = artDirection.paletteHint
negative = artDirection.negativePrompt + templates[purpose].extraNegative
formato  = templates[purpose].aspectRatio / size
```

- Plantillas por propósito (`AssetPurpose`): `card_illustration`, `character_portrait`, `icon`, `badge`, `cover`, `background`, `video`, `animation`.
- El resultado se guarda en `MediaAsset.generation` (`prompt`, `negativePrompt`, `model`, `seed`, `aestheticVersion`, `purpose`).

### 4.2 Qué define un buen `ArtDirection`
- `styleSummary`: 2–4 frases entendibles por humanos (qué estilo, qué referentes genéricos, qué sensación).
- `basePrompt` + `keywords` + `mood` + `paletteHint`: el vocabulario que se repite en todas las imágenes.
- `negativePrompt`: lo que el juego **nunca** debe mostrar (texto embebido, marcas, estilos ajenos, etc.).
- `consistencyRules`: reglas verificables (encuadre, iluminación, proporciones, fondo, nivel de detalle).
- `referenceAssetIds`: 3–8 imágenes de referencia aprobadas, para anclar consistencia.
- `seed` y `recommendedModel`: opcionales, mejoran la repetibilidad.

### 4.3 Consistencia de personajes
- Cada `Character` debería tener una **descripción visual canónica** (en `metadata.visualDescription`, tipado por juego según `§8`) y un retrato de referencia aprobado.
- Las cartas con `characterId` inyectan esa descripción en `{{character}}` para mantener el aspecto entre cartas.

### 4.4 Derechos y contenido
- Los `basePrompt`/`keywords` **no deben nombrar obras, personajes, marcas ni artistas protegidos**. Describir el estilo con atributos (técnica, paleta, época, tono), no con referentes específicos. Validar en el script de contenido (lista de términos bloqueados configurable).
- Documentar en `metadata` del perfil qué herramienta/licencia se usó para generar el arte.

### 4.5 Regeneración
- Al subir `AestheticProfile.version`, un script lista los assets con `generation.aestheticVersion` anterior (`npm run assets:outdated`) y puede generar un reporte o regenerarlos en lote.
- Los assets `source: 'upload'` o `'manual'` no se regeneran; solo se marcan como "fuera de guía" si el creador lo solicita.

---

## 5. Tokens de diseño y tematización en runtime

### 5.1 Tokens
- `ColorScheme` define **colores semánticos**, no de componente: `background`, `surface`, `surfaceAlt`, `border`, `textPrimary`, `textSecondary`, `accent`, `accentContrast`, `positive`, `negative`, `warning`, `info`, `overlay`.
- `light` y/o `dark` (al menos uno); `defaultScheme` indica el predeterminado. Respetar la preferencia del sistema solo si el juego define ambos.
- `parameterColors` da un color propio a cada parámetro (barras, deltas); debe cumplir contraste (§8).
- `radius`, `borderWidth`, `spacingUnit`, `shadows` y `motion` (duraciones, easing, `cardTransition`: `slide | fade | flip | stack`).

### 5.2 Implementación
- Un `ThemeProvider` convierte el perfil en **CSS custom properties** sobre el contenedor del juego (`--color-background`, `--font-display`, `--radius-md`, `--motion-base`, …). Ningún componente usa colores o fuentes literales.
- Los `ThemeOverride` se evalúan con el **mismo evaluador de `Condition`** del motor (`evaluateCondition`) contra la `GameSession` actual y se mezclan sobre los tokens base. Cambiar de rama o etapa actualiza las variables con una transición suave (respetando `prefers-reduced-motion`).
- Fase 1: el perfil vive en `src/content/<gameSlug>/aesthetic.json` (parte del build). Fase 2: vía `ApiContentRepository`. Agregar `getAesthetic(aestheticId)` y `getIcons(gameId)` a `GameContentRepository`.

### 5.3 Movimiento
- `cardTransition` define cómo entra/sale una carta; `motion.*` define duraciones y easing.
- Con `prefers-reduced-motion: reduce`, se usa `fade` corto sin desplazamientos y se omiten animaciones de video/lottie decorativas.

---

## 6. Tipografía

### 6.1 Roles
Cada juego define **mínimo dos** y **recomendado tres** familias:

| Rol | Uso | Notas |
|---|---|---|
| `display` | Títulos, nombre del juego, encabezados de carta | Carácter fuerte; puede tener pocos pesos |
| `body` | Texto de la situación, opciones, ayudas | Máxima legibilidad en tamaños chicos |
| `accent` (recomendado) | Números de parámetros, etiquetas, citas, nombres de personajes | Aporta contraste (monoespaciada, condensada, manuscrita, etc.) |

### 6.2 Escala
`Typography.scale` fija `title`, `cardText`, `option`, `label`, `number`, `caption`; cada uno referencia un rol, tamaño, interlineado, peso y espaciado. Los componentes consumen la escala, no tamaños sueltos.

### 6.3 Carga y rendimiento
- `source: 'google' | 'self_hosted' | 'system'`. Preferir **self-hosted** en `public/fonts` (WOFF2) para control y privacidad; `license` obligatoria si es self-hosted.
- Cargar solo los `weights` y `subsets` declarados; `font-display: swap`; precargar `display` y `body`.
- `fallback` obligatorio (stack de sistema equivalente) para evitar saltos de layout.
- **Las fuentes deben cubrir los caracteres del español rioplatense** (á é í ó ú ñ ¿ ¡ ü); validarlo en el script de contenido cuando sea posible.

### 6.4 Idiomas
- `localeOverrides` permite sustituir fuentes por idioma (escrituras no latinas, por ejemplo). Si una fuente no cubre el idioma de la sesión, usar el `fallback`.

---

## 7. Íconos (estrategia para comunicar parámetros sin texto)

### 7.1 Principio
Cada **parámetro**, **poder** e **insignia** tiene un `Icon` que comunica su concepto. El texto (`Parameter.name`) queda como **etiqueta accesible, tooltip y detalle**, no como elemento principal.

### 7.2 Estilo consistente
`IconStyle` fija, para todo el juego: `variant` (`line | solid | duotone | pixel | flat_color | illustrated`), `gridSize`, `strokeWidth`, `corners`, `format` (`svg | png | lottie`) y `colorMode`:
- `currentColor`: el ícono toma el color del contexto (recomendado para `line`/`solid`; permite estados y temas gratis).
- `palette`: usa tokens de la paleta.
- `fixed`: colores propios (para `illustrated`/`flat_color`).

### 7.3 Producción de íconos
1. Definir el **concepto** de cada ícono desde `Parameter`/`Power`/`Badge` (`semanticTags` + `label`). Un concepto = una metáfora visual clara y distinguible a 24–32 px.
2. Generarlos con la plantilla `templates.icon` + `IconStyle.generationNotes`, **como set** (mismo prompt base, misma semilla/referencia) para garantizar coherencia.
3. Preferir **SVG** limpio (vectorizar y optimizar con SVGO) para que escalen y hereden color. Guardar `Icon.svg` inline (íconos chicos) o `Icon.assetId`.
4. Variantes de estado opcionales (`states`: `default | danger | full | locked`) para reflejar parámetro bajo, al máximo o bloqueado.

### 7.4 Reglas de uso
- **Nunca** comunicar un parámetro solo por color: ícono + valor/barra + `aria-label` con `Icon.label` (localizado).
- Los íconos de parámetros **deben ser distinguibles entre sí** en escala de grises y con daltonismo.
- Primera vez que aparece un parámetro, mostrar ícono + nombre; luego solo ícono (con tooltip/long-press).
- Cobertura obligatoria: todo `Parameter` activo del juego debe tener `iconId` válido (validado en CI).

### 7.5 Fallback (cadena de resolución)
1. `Icon` propio del elemento (`iconId`).
2. Ícono genérico por `semanticTags` coincidente en la biblioteca del juego.
3. Inicial o abreviatura del nombre localizado dentro de un círculo con `parameterColors`.

---

## 8. Validaciones automáticas (`npm run validate:content`)

Extender el validador de `narratives-init.md §3.1` con:

1. `Game.aestheticId` existe y cumple el esquema de `§9`.
2. Tipografía: existen `display` y `body`; todas las fuentes tienen `fallback`; `self_hosted` tiene `url` y `license`; los pesos de `scale` existen en `weights`.
3. Contraste **WCAG AA** (≥ 4.5:1 texto normal, ≥ 3:1 texto grande y componentes UI) para: `textPrimary/background`, `textPrimary/surface`, `textSecondary/surface`, `accentContrast/accent`, y cada `parameterColors` contra `surface`. Para ambos esquemas (`light`/`dark`) cuando existan.
4. Todos los `Parameter` activos, `Power` y `Badge` tienen `iconId` válido; cada `Icon` tiene `svg` o `assetId` y `label.default`.
5. Los íconos `currentColor` no contienen colores fijos en el SVG.
6. `ThemeOverride.when` usa solo tipos de `Condition` válidos y referencias existentes.
7. `ArtDirection`: `basePrompt` y `negativePrompt` no vacíos; al menos plantillas para `card_illustration` y `icon`; sin términos de la lista de bloqueo (§4.4).
8. Todo `MediaAsset` oficial con `generation.source = 'ai'` tiene `prompt`, `aestheticId` y `aestheticVersion`.

Los errores de 1–6 y 8 **rompen el build**; 7 puede ser advertencia configurable.

---

## 9. Degradación y manejo de errores

| Falla | Comportamiento |
|---|---|
| Fuente no carga | Se usa `fallback` sin cambiar el layout |
| Ícono faltante | Cadena de §7.5 |
| Asset de carta no carga | Retrato del personaje; si no hay, solo texto (misma prioridad de `narratives-init.md §8`) |
| `aestheticId` inválido | Tema por defecto de la plataforma + log de error; el juego sigue |
| Override con condición inválida | Se ignora ese override |

---

## 10. Contenido de usuarios y estética

- Los creadores **no editan** el `AestheticProfile` del juego (requiere permiso `edit_game`, ver `narratives-init.md §7`).
- Al crear una carta, el editor **muestra la guía**: `styleSummary`, `consistencyRules`, referencias y el **prompt compuesto** listo para copiar (`composePrompt` con el `subject` que escriba el creador), para que generen imágenes alineadas con el juego.
- Si el creador sube un asset propio, `generation.source = 'upload'`. El revisor ve en la cola de revisión si el asset sigue la guía (checklist simple: formato, relación de aspecto, estilo).
- Límites de subida: tipos MIME permitidos, tamaño máximo y relación de aspecto de `templates.card_illustration`.

---

## 11. Estructura de proyecto sugerida

```
src/
  domain/models.ts                  # §9 incluido
  theme/
    ThemeProvider.tsx               # perfil → CSS variables, overrides por Condition
    composeTheme.ts                 # mezcla tokens base + overrides activos
    fonts.ts                        # carga y preload de fuentes por rol
    contrast.ts                     # utilidades WCAG
  assets/
    composePrompt.ts                # composición de prompts (§4.1)
    iconResolver.ts                 # cadena de fallback (§7.5)
  content/<gameSlug>/
    aesthetic.json
    icons/*.svg
    icons.json                      # entidades Icon
scripts/
  validate-content.ts               # + reglas §8
  assets-outdated.ts                # lista assets con aestheticVersion vieja
public/fonts/                       # WOFF2 self-hosted
```

---

## 12. Flujo para crear la estética de un juego nuevo (checklist)

1. Redactar `ArtDirection`: `styleSummary`, `basePrompt`, `negativePrompt`, `keywords`, `mood`, `paletteHint`, `consistencyRules` (sin nombrar obras ni artistas).
2. Generar 3–8 imágenes de referencia, aprobarlas y registrarlas en `referenceAssetIds`.
3. Definir `ColorScheme` (y `parameterColors`) alineado con `paletteHint`; verificar contraste.
4. Elegir 2–3 tipografías (display, body, accent); verificar licencia y cobertura de caracteres.
5. Definir `IconStyle` y listar los conceptos de ícono de cada parámetro/poder/insignia.
6. Generar y limpiar el set de íconos; cargarlos como `Icon`.
7. Definir plantillas de prompt por `AssetPurpose` (mínimo `card_illustration`, `character_portrait`, `icon`).
8. Definir movimiento (`motion`) y, si aplica, `ThemeOverride` por rama/etapa.
9. Correr `npm run validate:content` y revisar visualmente en una vista de "style guide" (ver §13).
10. Publicar con `version = 1`; todo cambio posterior incrementa `version`.

---

## 13. Criterios de aceptación

1. Cambiar `Game.aestheticId` a otro perfil cambia colores, fuentes, íconos, radios y animaciones **sin modificar código de componentes**.
2. `composePrompt()` produce prompts deterministas para el mismo input y los guarda en `MediaAsset.generation`.
3. El validador falla ante: contraste insuficiente, parámetro sin ícono, fuente sin fallback, perfil sin `display`/`body`, override inválido.
4. Un `ThemeOverride` por rama cambia la paleta al entrar a esa rama y revierte al salir, con transición (y sin ella bajo `prefers-reduced-motion`).
5. Todos los parámetros se identifican por ícono con `aria-label` localizado; ninguna información depende solo del color.
6. Con una fuente o ícono ausente, la UI usa los fallbacks de §9 sin errores visibles.
7. Existe una pantalla interna **Style Guide** que muestra paleta, escala tipográfica, set de íconos y una carta de ejemplo con el perfil activo.
8. `npm run assets:outdated` lista los assets generados con una `aestheticVersion` anterior.
9. El editor de cartas muestra la guía estética y el prompt compuesto copiable.
10. Tests unitarios: `composeTheme` (overrides), `composePrompt`, `iconResolver`, utilidades de contraste.

---

## 14. Riesgos y notas

- **Consistencia entre generaciones de IA:** mitigar con referencias, semilla, reglas de consistencia y set de íconos generado en bloque.
- **Licencias:** de fuentes (self-hosted) y de las herramientas de generación; registrarlas.
- **Peso de página:** limitar pesos de fuente y optimizar SVG/WOFF2; lazy loading de video/animaciones.
- **Deriva visual:** el contenido de usuarios puede salirse de la guía; la revisión (`in_review`) es el control.
- **Cambios de estética:** siempre versionar; un cambio de paleta puede romper contraste, por eso el validador corre en CI.
- **Daltonismo:** probar paletas de parámetros con simuladores; el ícono y el valor numérico deben bastar para entender el estado.

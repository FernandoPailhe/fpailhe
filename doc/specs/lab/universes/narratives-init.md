# Narratives — Spec inicial de implementación

> Documento destinado a un agente de implementación. Define el alcance, las reglas del motor, la arquitectura híbrida de la Fase 1 y los criterios de aceptación.
> **Fuente de verdad de los tipos:** `narrative-game-models.ts` (se referencia por sección: `§1 Base`, `§2 Definición`, `§3 Reglas`, `§4 Contenido`, `§5 Estado`, `§6 Analítica`, `§7 Usuarios`, `§8 Extensión`). No redefinir tipos en otro lugar; importar desde ese archivo.

---

## 1. Visión

Plataforma de juegos de rol narrativos basados en decisiones. El jugador recibe **cartas de situación**; cada una ofrece **1 a 3 decisiones**. Cada decisión altera **parámetros** del universo (siempre con trade-off: algo sube, algo baja), puede **bifurcar la narrativa**, desbloquear **personajes** y **poderes**, y eventualmente disparar derrota, victoria o premios.

El modelo debe servir para **múltiples juegos** (fútbol, gobierno, etc.) y para **contenido creado por usuarios**, sin cambiar el esquema base. La extensión por tipo de juego se hace con `metadata` tipado (`§8`) y con reglas declarativas (`Condition` / `Effect`, `§3`).

## 2. Alcance por fases

### Fase 1 (este spec): sitio web React, un único juego
- Un solo `Game` (tema ya definido por el dueño del proyecto, se carga como datos).
- Contenido **oficial** (creado por el admin) embebido en el **build**.
- Contenido de **usuarios** (cartas) en **Firebase** (Firestore + Storage para media).
- Estado de partida en el cliente.
- Debe usar **exactamente** el modelo de `narrative-game-models.ts`.

### Fase 2 (fuera de alcance, pero no debe romperse)
- VPS con API y base de datos propia; múltiples juegos; creación de juegos por usuarios.
- La migración debe consistir en agregar una `ApiRepository` sin tocar el motor ni la UI (ver §4).

### Fuera de alcance de Fase 1
- Progreso global entre partidas (ver §9.5: **no existe**).
- Creación de juegos nuevos por usuarios.
- Panel de administración completo (el admin edita JSON en el repo; la revisión de cartas puede ser un script o vista mínima, ver §10).

---

## 3. Modelo de datos — resumen y referencias

Todos los tipos están en `narrative-game-models.ts`. Resumen de qué representa cada uno y reglas de uso:

| Concepto | Tipo (`§`) | Notas clave |
|---|---|---|
| Base | `Entity`, `GameScoped`, `Authored`, `LocalizedText` (§1) | Todo lleva `schemaVersion`, timestamps y `metadata?` |
| Juego | `Game`, `GameConfig` (§2) | `kind` engancha extensión tipada (§8) |
| Etapas/niveles | `Stage` (§2) | Activan parámetros, definen `difficultyRange` (1..10) |
| Ramas | `Branch` (§2) | Múltiples activas a la vez; `exclusiveGroup` opcional |
| Parámetros | `Parameter`, `ParameterThreshold` (§2) | `min/max` típico 0–100; thresholds disparan `Effect[]` |
| Reglas | `Condition`, `Effect`, `Comparator` (§3) | Uniones discriminadas; el motor las interpreta |
| Multimedia | `MediaAsset` (§4) | `image` / `video` / `animation`; un solo asset por carta |
| Personajes | `Character` (§4) | `themeTags`, habilitación por juego/partida |
| Poderes | `Power`, `PowerKind` (§4) | `shield`, `option_unlock`, `modifier`, `custom` |
| Insignias | `Badge` (§4) | Se ganan por `award_badge`; solo viven en la partida |
| Cartas | `SituationCard`, `CardAvailability`, `CardRecurrence`, `DecisionOption` (§4) | Opciones embebidas en la carta |
| Partida | `GameSession` (§5) | Todo el estado del jugador |
| Analítica | `CardImpression`, `CardFeedback`, `CardStats` (§6) | Calibran el peso y la dificultad |
| Usuarios | `User` (§7) | `isCreator` habilita crear cartas |
| Colaboración | `GamePermission`, `GameCollaborator`, `ContributionRequest` (§7) | Aportes a juegos ajenos con permiso del dueño |
| Extensión | `FootballManagerGameMeta` etc. (§8) | Ejemplo de `metadata` tipado |

### 3.1 Reglas de integridad (validar al cargar contenido)
1. Toda referencia por id (`parameterId`, `characterId`, `branchId`, `powerId`, `badgeId`, `assetId`, `cardId`) debe resolverse dentro del mismo `gameId`.
2. `SituationCard.options.length` ∈ {1, 2, 3}. `order` único dentro de la carta.
3. Como mucho una opción `kind: 'balance'` por carta.
4. `difficulty` es entero 1..10; `Stage.difficultyRange` dentro de 1..10 y `min <= max`.
5. `Parameter.min < Parameter.max` y `initialValue` dentro del rango.
6. `LocalizedText.default` obligatorio y no vacío; `translations` opcional.
7. Una carta con `characterId` solo es elegible si ese personaje está desbloqueado (salvo `requireCharacterUnlocked: false`).
8. Carta o contenido de usuario con referencias inválidas (por cambio de build) → **se descarta** y se registra en consola; nunca rompe la partida.
9. Cada `Parameter` activo al inicio debe estar en `GameConfig.initialActiveParameterIds`.

### 3.2 Localización
- Todo texto visible al jugador (cartas, opciones, parámetros, personajes, poderes, etapas, ramas, insignias, `outcomeText`, `altText`) usa `LocalizedText`.
- Resolución: `translations[session.locale] ?? translations[language base] ?? default`.
- Fallback al `default` sin error si falta la traducción.

---

## 4. Arquitectura (Fase 1 híbrida)

### 4.1 Principio rector
El **motor del juego** y la **UI** dependen solo de interfaces de repositorio. Nunca importan JSON ni Firebase directamente.

```ts
// Repositorios (a crear; tipos de dominio importados de narrative-game-models.ts)
interface GameContentRepository {
  getGame(gameId: ID): Promise<Game>;
  getStages(gameId: ID): Promise<Stage[]>;
  getBranches(gameId: ID): Promise<Branch[]>;
  getParameters(gameId: ID): Promise<Parameter[]>;
  getCharacters(gameId: ID): Promise<Character[]>;
  getPowers(gameId: ID): Promise<Power[]>;
  getBadges(gameId: ID): Promise<Badge[]>;
  getAssets(gameId: ID, ids?: ID[]): Promise<MediaAsset[]>;
}

interface CardRepository {
  getPublishedCards(gameId: ID): Promise<SituationCard[]>;
  getCardStats(gameId: ID): Promise<CardStats[]>;
}

interface UserCardRepository { // solo creadores
  createCard(card: SituationCard): Promise<void>;       // siempre status 'in_review' (salvo permisos)
  updateOwnCard(card: SituationCard): Promise<void>;
  listOwnCards(userId: ID): Promise<SituationCard[]>;
}

interface FeedbackRepository {
  submitFeedback(fb: CardFeedback): Promise<void>;
  recordImpression(imp: CardImpression): Promise<void>; // en Fase 1 puede ser no-op o muestreado
}

interface SessionRepository {
  load(userId: ID, gameId: ID): Promise<GameSession | null>;
  save(session: GameSession): Promise<void>;
}
```

### 4.2 Implementaciones de Fase 1
| Interfaz | Implementación Fase 1 | Fase 2 |
|---|---|---|
| `GameContentRepository` | `BundledContentRepository` (JSON en el build) | `ApiContentRepository` |
| `CardRepository` | `MergedCardRepository` = `BundledCardRepository` + `FirestoreCardRepository` | `ApiCardRepository` |
| `UserCardRepository` | `FirestoreUserCardRepository` | `ApiUserCardRepository` |
| `FeedbackRepository` | `FirestoreFeedbackRepository` (contadores agregados) | `ApiFeedbackRepository` |
| `SessionRepository` | `LocalSessionRepository` (IndexedDB/localStorage) | `ApiSessionRepository` |

`MergedCardRepository`: une cartas oficiales (build) y cartas de usuarios con `status: 'published'` (Firestore), valida referencias (§3.1.8), y devuelve un único arreglo. Ante fallo de Firestore, **degrada a solo oficiales** sin romper el juego.

### 4.3 Contenido oficial en el build
- Directorio sugerido: `src/content/<gameSlug>/` con archivos JSON o TS tipados: `game.json`, `stages.json`, `branches.json`, `parameters.json`, `characters.json`, `powers.json`, `badges.json`, `assets.json`, `cards/*.json`.
- Un script de **validación de build** (`npm run validate:content`) aplica §3.1 y falla el build si hay errores. Debe correrse en CI y antes de `build`.
- Los assets oficiales pueden ir en `/public/assets/...` (o Firebase Storage); `MediaAsset.url` refleja la ubicación.
- Los ids oficiales usan prefijo `off_`.

### 4.4 Contenido de usuarios en Firebase
- **Firestore**: colecciones `cards`, `cardFeedback`, `cardStats`, `users`, `collaborators`, `contributionRequests`. (Cartas en Firestore y no en Storage, porque requieren consulta y filtro.)
- **Storage**: solo archivos multimedia subidos por creadores (imágenes, videos, animaciones), con límites de tamaño y tipo MIME permitidos.
- Los ids de usuario usan prefijo `usr_` (o UUID) para evitar colisiones con `off_`.
- Las cartas de usuario referencian entidades **oficiales** (parámetros, ramas, personajes, poderes) por id.

### 4.5 Reglas de seguridad (requisitos)
Implementar reglas de Firestore y Storage con estas condiciones:

1. Crear/editar cartas: usuario registrado (no anónimo); las cartas quedan en revisión y solo el admin las publica (D-78). `isCreator` ya no es requisito. `isCreator` vive en un documento `users/{uid}` **no editable por el cliente** (o en custom claims). Nunca confiar en un campo enviado por el cliente.
2. Toda carta nueva se crea con `status: 'in_review'`. Solo el admin (dueño) o un colaborador con permiso `review` puede pasarla a `published` o `rejected`. Con permiso `auto_publish`, puede crearla como `published`.
3. Un creador solo puede leer/editar **sus propias** cartas en `draft`/`in_review`/`rejected`. Cualquier usuario puede leer cartas `published`.
4. Un creador no puede modificar los campos `status`, `review`, `origin` ni `createdBy`.
5. `cardFeedback`: usuario autenticado (o anónimo si se decide), un voto por `(userId, cardId, sessionId)`; escritura solo de su propio feedback.
6. `cardStats`: escritura solo vía contador atómico (`FieldValue.increment`) o Cloud Function; lectura pública.
7. Storage: solo creadores escriben; validar `contentType` (`image/*`, `video/*`, formatos de animación permitidos) y tamaño máximo.
8. Un creador sin permiso `contribute` en el juego **no** puede crear cartas en él (en Fase 1 hay un único juego del admin: el admin otorga `isCreator`/permiso).

---

## 5. Motor del juego

El motor es una librería pura y testeable (sin React, sin Firebase). Entrada: contenido + `GameSession`. Salida: nueva `GameSession` + eventos para la UI.

### 5.1 Inicio de partida
Crear `GameSession` desde `GameConfig`:
- `parameters[id] = initialValue` para todos los parámetros (activos o no).
- `activeParameterIds = initialActiveParameterIds`.
- `unlockedCharacterIds = initialUnlockedCharacterIds ∪ {personajes con unlockedByDefault}`.
- `branchIds = initialBranchIds`; `powers = initialPowers ?? []`.
- `stageId` = etapa de menor `order`; `turn = 0`; `score = 0`; `status = 'active'`.
- Ejecutar `Stage.onEnter` de la etapa inicial.

### 5.2 Ciclo de un turno
1. **Elegir carta** (§5.3).
2. Mostrar carta (UI). Registrar `CardImpression` (inicio).
3. Calcular **opciones disponibles** (§5.4).
4. El jugador elige una opción.
5. **Resolver efectos** (§5.5).
6. Evaluar **thresholds** de parámetros y shields (§5.6).
7. Evaluar **avance de etapa** (§5.7) y desbloqueos automáticos de personajes (`Character.unlockCondition`).
8. Actualizar `cardHistory`, `turn += 1`, `score` (vía efectos).
9. Si `status` ≠ `active`, terminar; si no, volver al paso 1.
10. Completar `CardImpression` (opción, tiempo de respuesta, parámetros antes/después, `causedGameOver`).

### 5.3 Selección de carta (algoritmo)
1. **Cola forzada primero:** si `cardQueue` tiene una carta con `dueTurn <= turn`, usarla (si sigue siendo válida por integridad; no se le aplican filtros de recurrencia).
2. Si no, filtrar el pool de cartas `published`:
   - `availability.branchIds` vacío/undefined (global) **o** intersecta con `session.branchIds`.
   - `minStageOrder <= etapa actual <= maxStageOrder` (si están definidos).
   - `difficulty` dentro de `Stage.difficultyRange` de la etapa actual.
   - `availability.conditions` evalúa a verdadero.
   - Personaje desbloqueado (§3.1.7).
   - Recurrencia: `once` → no vista antes; `repeatable` → respeta `cooldownTurns` y `maxPerSession`.
   - No pertenece a las últimas `recentCardsWindow` cartas mostradas.
   - Debe tener al menos 1 opción disponible (§5.4).
3. **Sorteo ponderado** por `CardStats.effectiveWeight` (si no hay stats, usar `baseWeight`).
4. Si el pool queda vacío: relajar en este orden — ventana de recientes → cooldown → rango de dificultad (ampliar ±1) — y si sigue vacío, fallback a cualquier carta global válida; si no existe ninguna, terminar la partida con `endingKey: 'no_cards'` y registrar el error.

### 5.4 Opciones disponibles
Para cada `DecisionOption`:
- Si `availability` existe y evalúa falso → no disponible.
- Si es `unlockTag` presente, está disponible solo si el jugador tiene un `Power` `option_unlock` con ese `unlocksOptionTag` y `charges >= 1` (los `option_unlock` pueden consumir carga según el diseño del poder; por defecto **no** consumen).
- No disponible + `whenUnavailable: 'hide'` → no se muestra; `'show_locked'` → se muestra deshabilitada.
- La opción `kind: 'balance'` típicamente exige un poder: configurar mediante `availability` (`has_power`) y/o `unlockTag`.
- Si el resultado deja 0 opciones seleccionables, la carta no es elegible (§5.3).

### 5.5 Resolución de efectos
Aplicar en el orden del arreglo:
- `modify_parameter`: `valor = clamp(valor + delta', min, max)`. `delta'` aplica los `Power` `modifier` activos (`multiplier` sobre positivos/negativos/ambos, opcionalmente por `parameterId`).
- `set_parameter`, `activate_parameter`, `deactivate_parameter`: directo (activar no cambia el valor).
- `add_score`: suma puntos.
- `set_flag`: asigna en `flags`.
- `enter_branch` / `leave_branch`: actualizan `branchIds`; al entrar a una rama con `exclusiveGroup`, salir de las demás del mismo grupo.
- `unlock_character` / `lock_character`: actualizan `unlockedCharacterIds`.
- `grant_power` / `consume_power`: suma/resta cargas respetando `maxCharges`; con 0 cargas, se elimina de `powers`.
- `award_badge`: agrega a `earnedBadgeIds` si no estaba (solo vive en la partida).
- `enqueue_card`: agrega a `cardQueue` con `dueTurn = turn + (delayTurns ?? 1)`.
- `end_game`: ver §5.6 (los shields pueden interceptarlo si trae `threatTags`).

Los efectos de la opción elegida se aplican y luego se evalúan thresholds. Un efecto que dispara otro (por threshold) se encola y se procesa en el mismo turno con un límite de profundidad (p. ej. 10) para evitar bucles.

### 5.6 Thresholds y shields
Tras los efectos, para cada parámetro **activo** cuyo valor cruzó un `ParameterThreshold` (`lte`/`gte`):
1. Si `once` y ya está en `firedThresholdIds`, ignorar.
2. Determinar `threatTags`: los del threshold ∪ los de la opción elegida (`DecisionOption.threatTags`).
3. Si el jugador tiene un `Power` `shield` cuyo `blocksThreatTags` intersecta, **consumir 1 carga**, **no disparar** los efectos del threshold, registrar `shieldUsedPowerId` en el `CardImpression`, y dejar el parámetro en un valor seguro (por defecto: el `min`/`max` clamped, sin disparar de nuevo en el mismo turno; configurable a futuro).
4. Si no hay shield, disparar los `effects` del threshold (típicamente `end_game` o `award_badge`) y agregarlo a `firedThresholdIds` si `once`.
5. `end_game` con `outcome: 'defeat'` → `status = 'lost'`; `'victory'` → `status = 'won'`; guardar `endingKey` y `endedAt`.

Un parámetro inactivo no dispara thresholds.

### 5.7 Etapas
- Tras cada turno, si existe una etapa con `order` mayor cuyo `minScore <= score` y `enterConditions` (si hay) se cumple, avanzar (una etapa por turno como máximo).
- Al entrar: activar `activatesParameterIds`, ejecutar `onEnter`, actualizar `stageId`.
- La dificultad de las cartas sorteadas sigue el `difficultyRange` de la etapa actual (menos progreso → cartas más fáciles).

### 5.8 Condiciones
Evaluar `Condition` recursivamente (`all` / `any` / `not` y hojas). Hojas: `parameter`, `score`, `stage_at_least`, `in_branch`, `has_flag`, `has_power`, `character_unlocked`, `card_seen` (con `optionId` opcional contra `cardHistory.lastOptionId`; si se necesita historial completo de opciones, extender `cardHistory` sin romper compatibilidad), `turn`. Una condición ausente es verdadera.

---

## 6. Calibración de cartas (analítica y feedback)

### 6.1 Datos que se registran
- **`CardImpression`** (§6): por carta mostrada. En Fase 1, guardar localmente y/o enviar agregado; el detalle completo se difiere a Fase 2 si los costos lo exigen.
- **`CardFeedback`** (§6): el jugador puede puntuar la carta como **positiva** (tiene sentido) o **negativa**, con `reason` opcional. UI: botones discretos tras resolver la carta, habilitado según `GameConfig.allowCardFeedback`.
- **`CardStats`** (§6): agregados por carta (impresiones, elecciones por opción, votos, game overs, tiempo medio de respuesta, tasa de pérdida posterior, dificultad observada).

### 6.2 Peso efectivo (valores iniciales ajustables)
```
effectiveWeight = baseWeight × feedbackFactor × difficultyFitFactor
feedbackFactor   = clamp(2 × (positive + 1) / (positive + negative + 2), 0.2, 2.0)   // suavizado bayesiano
difficultyFitFactor = 1 - min(0.5, |observedDifficulty - difficulty| / 10)
```
- Si `impressions < N_min` (p. ej. 20), usar solo `baseWeight`.
- `needsReview = true` si `negative / (positive + negative) > 0.6` con muestra suficiente, o `lossRateAfter` anormalmente alta respecto de su dificultad declarada.
- Constantes (`N_min`, umbrales, ventana de pérdida) en un archivo de configuración único.

### 6.3 Actualización
- Fase 1: contadores atómicos en Firestore (`FieldValue.increment`) y recálculo de `effectiveWeight` en el cliente al cargar (o Cloud Function si se habilita).
- El cliente **no es confiable**; los pesos son orientativos en la prueba. En Fase 2 el cálculo pasa al servidor.

---

## 7. Creación de contenido y permisos

- Solo usuarios **autenticados** con `isCreator == true` pueden crear cartas (`§7 User`).
- **Flujo de una carta de usuario:** `draft` → `in_review` → (`published` | `rejected` | `changes_requested`) → `archived`. El bloque `Authored.review` registra revisor, fecha, decisión y notas.
- **Juegos ajenos (Fase 2, pero modelado ya):** se aportan cartas solo con permiso del dueño (`GameCollaborator.permissions` incluye `contribute`). Un creador sin permiso envía un `ContributionRequest` al dueño. `auto_publish` permite publicar sin revisión; `review` permite aprobar/rechazar; `edit_game` permite modificar parámetros, etapas y ramas. El dueño tiene todos los permisos implícitos.
- **Archivado en cascada:** si el dueño archiva o elimina un juego, **todas** sus cartas (incluidas las de otros creadores) pasan a `archived`. No se notifica en Fase 1.
- **Editor de cartas (UI mínima de Fase 1):** formulario para texto (con traducciones opcionales), personaje opcional, asset opcional, `themeTags`, `difficulty` (1..10), recurrencia, disponibilidad (ramas, etapas, condiciones simples) y de 1 a 3 opciones con efectos. Validar con las mismas reglas de §3.1 antes de enviar.

---

## 8. Presentación de la carta (UI)

Orden de prioridad visual (todo opcional salvo el texto):
1. Si la carta tiene `assetId` → mostrar el asset (imagen, video o animación).
2. Si no, y tiene `characterId` → mostrar el retrato del personaje y su nombre/título.
3. Si no → solo el texto de la situación.

Además: mostrar los parámetros activos (con valor actual y cambio tras la decisión), las opciones disponibles (con estado locked si corresponde), poderes en posesión y personaje emisor cuando exista.

---

## 9. Decisiones de producto confirmadas

1. Estado de revisión de contenido de creadores: `in_review`.
2. Dificultad de cartas: escala entera **1 a 10**.
3. Cartas con memoria de acciones pasadas: **sí** (`card_seen` con `optionId` y `flags`).
4. Varias ramas activas a la vez: **sí** (`exclusiveGroup` opcional).
5. **No** hay progreso global entre partidas: insignias, poderes y desbloqueos viven solo en la `GameSession`. No existe `UserBadge`.
6. Aportes a juegos ajenos: **con permiso del creador** del juego.
7. Si el dueño archiva/borra el juego, sus cartas de terceros se **archivan**.
8. La opción de equilibrio (`balance`) es de bajo costo/beneficio y puede quedar habilitada solo con una carta/poder que la desbloquee.
9. Contenido oficial: build. Contenido de usuarios: Firebase (cartas en Firestore, media en Storage).

---

## 10. Estructura de proyecto sugerida

```
src/
  domain/
    models.ts                 # = narrative-game-models.ts (fuente de verdad)
  engine/
    session.ts                # creación y serialización de GameSession
    conditions.ts             # evaluateCondition()
    effects.ts                # applyEffects(), thresholds, shields
    cardSelection.ts          # selección ponderada
    stages.ts                 # avance de etapas
    weights.ts                # cálculo de effectiveWeight / needsReview
    validation.ts             # reglas de integridad §3.1
  repositories/
    interfaces.ts
    bundled/                  # contenido oficial del build
    firebase/                 # Firestore + Storage
    merged/                   # MergedCardRepository
    local/                    # LocalSessionRepository
  content/<gameSlug>/         # JSON oficiales (prefijo off_)
  ui/                         # React: pantalla de carta, parámetros, editor de cartas
scripts/
  validate-content.ts         # corre en CI y en prebuild
firebase/
  firestore.rules
  storage.rules
```

---

## 11. Criterios de aceptación (Fase 1)

1. `npm run validate:content` falla ante cualquier violación de §3.1 en el contenido oficial.
2. Una partida completa funciona **sin conexión a Firebase** usando solo contenido oficial.
3. Con Firebase disponible, las cartas de usuarios `published` aparecen mezcladas con las oficiales; las inválidas se descartan sin romper el juego.
4. Un parámetro que llega a su límite dispara el threshold configurado; con un shield aplicable, se consume la carga y no se dispara.
5. Una carta de rama X **no** aparece fuera de la rama X; las globales aparecen siempre que cumplan filtros.
6. Cartas `once` no reaparecen; las `repeatable` respetan `cooldownTurns` y `maxPerSession`.
7. La opción `balance` solo aparece cuando su condición/poder se cumple.
8. Los parámetros nuevos se activan al avanzar de etapa y el rango de dificultad cambia con ella.
9. Todo texto visible cae a `default` si falta traducción en el idioma de la sesión.
10. Un usuario sin `isCreator` no puede crear cartas (verificado por reglas de Firestore, no solo por UI).
11. El feedback positivo/negativo modifica `effectiveWeight` según §6.2.
12. Reemplazar `BundledContentRepository`/Firestore por una implementación en memoria (tests) no requiere tocar motor ni UI.
13. Tests unitarios del motor: condiciones, efectos, thresholds, shields, selección de cartas, etapas y pesos.

---

## 12. Riesgos y notas para el implementador

- Las reglas de seguridad de Firestore son la barrera real; la UI no alcanza.
- Los pesos calculados en cliente son manipulables; aceptable en prueba, migrar al servidor en Fase 2.
- Evitar bucles de efectos encadenados (límite de profundidad, §5.5).
- Mantener `schemaVersion` y migraciones simples para cartas guardadas en Firestore.
- No acoplar el motor a React ni a Firebase: es lo que permite migrar al VPS sin reescribir.
- Preferir contenido oficial pequeño y lazy loading si el volumen crece.

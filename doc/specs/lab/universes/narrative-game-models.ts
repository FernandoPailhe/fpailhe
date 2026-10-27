/**
 * Modelo de datos — Plataforma de juegos de rol narrativos basados en decisiones.
 *
 * Capas:
 *  1. Base / utilidades (ids, localización, auditoría)
 *  2. Definición del juego (Game, Stage, Branch, Parameter)
 *  3. Reglas (Condition, Effect) — el "motor" declarativo que une todo
 *  4. Contenido (Character, Power, Badge, MediaAsset, SituationCard, DecisionOption)
 *  5. Estado del jugador (GameSession)
 *  6. Analítica y feedback (CardImpression, CardFeedback, CardStats)
 *  7. Usuarios y autoría
 *  8. Ejemplo de extensión por tipo de juego
 *  9. Estética: dirección de arte, tokens de diseño, tipografías, íconos
 */

/* ============================================================
 * 1. BASE
 * ============================================================ */

export type ID = string;
export type ISODate = string;
export type LocaleCode = string; // "es-AR", "en", "pt-BR"...

export interface Entity {
  id: ID;
  /** Para migraciones futuras del esquema */
  schemaVersion: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Punto de extensión libre; cada tipo de juego puede tiparlo (ver sección 8) */
  metadata?: Record<string, unknown>;
}

/** Texto por defecto + traducciones opcionales. Fallback: translations[locale] ?? default */
export interface LocalizedText {
  default: string;
  translations?: Record<LocaleCode, string>;
}

/** Todo lo que pertenece a un juego */
export interface GameScoped extends Entity {
  gameId: ID;
}

/** Contenido que puede crear un usuario con isCreator */
export interface Authored {
  createdBy: ID; // User.id
  origin: 'official' | 'community';
  status: 'draft' | 'in_review' | 'published' | 'archived';
  /** Revisión: quien aprueba es el dueño del juego (o un colaborador con permiso 'review') */
  review?: {
    submittedAt?: ISODate;
    reviewedBy?: ID;
    reviewedAt?: ISODate;
    decision?: 'approved' | 'rejected' | 'changes_requested';
    notes?: string;
  };
}

/* ============================================================
 * 2. DEFINICIÓN DEL JUEGO
 * ============================================================ */

export interface Game extends Entity, Authored {
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  defaultLocale: LocaleCode;
  supportedLocales: LocaleCode[];
  coverAssetId?: ID;
  /** Estética vigente del juego (§9). Cada juego tiene la suya. */
  aestheticId: ID;
  /** Tipo de juego: permite engancharle una extensión tipada (sección 8) */
  kind: string; // "football_manager" | "government" | ...
  visibility: 'private' | 'unlisted' | 'public';
  /** Reglas generales del mazo */
  config: GameConfig;
}

export interface GameConfig {
  /** Cuántas cartas "recientes" se evitan para no repetir */
  recentCardsWindow: number;
  /** Parámetros activos al inicio. Los demás se activan por Stage o por Effect. */
  initialActiveParameterIds: ID[];
  /** Personajes habilitados al inicio */
  initialUnlockedCharacterIds: ID[];
  initialBranchIds: ID[];
  initialPowers?: { powerId: ID; charges: number }[];
  /** Si true, el jugador puede puntuar cartas */
  allowCardFeedback: boolean;
}

/** Niveles de progreso: la dificultad y los parámetros crecen con el avance */
export interface Stage extends GameScoped {
  order: number;
  name: LocalizedText;
  /** Puntaje mínimo (o condición) para entrar a la etapa */
  minScore: number;
  enterConditions?: Condition;
  /** Al entrar, se activan estos parámetros (ej: de 2 a 5) */
  activatesParameterIds?: ID[];
  onEnter?: Effect[];
  /** Rango de dificultad de cartas que se sortean en esta etapa */
  difficultyRange: { min: number; max: number }; // dentro de 1..10
}

/** Bifurcación narrativa. Las cartas pueden pertenecer a una o varias ramas. */
export interface Branch extends GameScoped {
  key: string;
  name: LocalizedText;
  description?: LocalizedText;
  /** Si es exclusiva, al entrar se sale de las ramas del mismo grupo */
  exclusiveGroup?: string;
}

export interface Parameter extends GameScoped {
  key: string; // "fan_love", "squad_morale"
  name: LocalizedText;
  description?: LocalizedText;
  /** Ícono comunicativo del parámetro (ver §9 Icon). La UI evita mostrar texto cuando hay ícono. */
  iconId?: ID;
  min: number; // normalmente 0
  max: number; // normalmente 100
  initialValue: number;
  /** Disparadores al tocar límites u otros umbrales */
  thresholds: ParameterThreshold[];
}

export interface ParameterThreshold {
  id: ID;
  comparator: 'lte' | 'gte';
  value: number; // ej: 0 o 100
  effects: Effect[]; // EndGame, AwardBadge, GoToBranch, EnqueueCard...
  /**
   * Tags de amenaza. Un Power de tipo "shield" con el mismo tag
   * intercepta este threshold y consume una carga.
   */
  threatTags?: string[];
  /** Si true, se dispara una sola vez por partida */
  once?: boolean;
}

/* ============================================================
 * 3. REGLAS DECLARATIVAS
 * ============================================================ */

export type Condition =
  | { type: 'all'; conditions: Condition[] }
  | { type: 'any'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }
  | { type: 'parameter'; parameterId: ID; comparator: Comparator; value: number }
  | { type: 'score'; comparator: Comparator; value: number }
  | { type: 'stage_at_least'; stageOrder: number }
  | { type: 'in_branch'; branchId: ID }
  | { type: 'has_flag'; flag: string; value?: string | number | boolean }
  | { type: 'has_power'; powerId: ID; minCharges?: number }
  | { type: 'character_unlocked'; characterId: ID }
  | { type: 'card_seen'; cardId: ID; optionId?: ID } // "ya vio la carta X" / "eligió Y"
  | { type: 'turn'; comparator: Comparator; value: number };

export type Comparator = 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'neq';

export type Effect =
  | { type: 'modify_parameter'; parameterId: ID; delta: number }
  | { type: 'set_parameter'; parameterId: ID; value: number }
  | { type: 'activate_parameter'; parameterId: ID }
  | { type: 'deactivate_parameter'; parameterId: ID }
  | { type: 'add_score'; points: number }
  | { type: 'set_flag'; flag: string; value: string | number | boolean }
  | { type: 'enter_branch'; branchId: ID }
  | { type: 'leave_branch'; branchId: ID }
  | { type: 'unlock_character'; characterId: ID }
  | { type: 'lock_character'; characterId: ID }
  | { type: 'grant_power'; powerId: ID; charges?: number }
  | { type: 'consume_power'; powerId: ID; charges?: number }
  | { type: 'award_badge'; badgeId: ID }
  | { type: 'enqueue_card'; cardId: ID; delayTurns?: number } // fuerza una carta futura
  | { type: 'end_game'; outcome: 'defeat' | 'victory'; endingKey?: string; threatTags?: string[] };

/* ============================================================
 * 4. CONTENIDO
 * ============================================================ */

export interface MediaAsset extends Entity, Authored {
  gameId?: ID; // null/undefined = reutilizable entre juegos
  type: 'image' | 'video' | 'animation';
  url: string;
  mimeType: string;
  /** Para animation: lottie, apng, gif... */
  format?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  posterUrl?: string; // miniatura para video/animación
  altText?: LocalizedText;
  sizeBytes?: number;
  /** Trazabilidad de cómo se produjo el asset (§9 AssetGeneration) */
  generation?: AssetGeneration;
}

export interface Character extends GameScoped {
  key: string; // "physical_trainer", "defense_minister"
  name: LocalizedText;
  title?: LocalizedText; // "Preparador físico"
  portraitAssetId?: ID;
  /** Tags temáticos: las cartas con estos tags pueden asignársele */
  themeTags: string[];
  /** Habilitado desde el inicio, o requiere desbloqueo */
  unlockedByDefault: boolean;
  /** Condición alternativa de desbloqueo automático */
  unlockCondition?: Condition;
}

/** Bonus / poderes que el jugador acumula */
export type Power = GameScoped & PowerKind & {
  key: string;
  name: LocalizedText;
  description?: LocalizedText;
  iconId?: ID; // §9 Icon
  maxCharges?: number; // tope de acumulación
  /** Se obtiene vía Effect grant_power, o aquí como cartas "coleccionables" */
};

export type PowerKind =
  /** Absorbe un threshold con ese threatTag (ej. rebelión interna) */
  | { kind: 'shield'; blocksThreatTags: string[] }
  /** Habilita opciones marcadas con ese tag (ej. la 3ª opción de equilibrio) */
  | { kind: 'option_unlock'; unlocksOptionTag: string }
  /** Modifica efectos: ej. +20% de efecto positivo en un parámetro */
  | { kind: 'modifier'; parameterId?: ID; multiplier: number; appliesTo: 'positive' | 'negative' | 'both' }
  /** Extensible a futuro */
  | { kind: 'custom'; payload: Record<string, unknown> };

export interface Badge extends GameScoped {
  key: string;
  name: LocalizedText;
  description?: LocalizedText;
  iconId?: ID; // §9 Icon
  rarity?: 'common' | 'rare' | 'epic';
}

export interface SituationCard extends GameScoped, Authored {
  text: LocalizedText;
  /** Opcional. Prioridad visual: asset > retrato del personaje > solo texto */
  assetId?: ID;
  characterId?: ID;
  themeTags: string[];

  /** Entero de 1 (muy fácil) a 10 (muy difícil) */
  difficulty: number; // 1..10

  /** Decisiones: 1, 2 o 3 */
  options: DecisionOption[];

  availability: CardAvailability;
  recurrence: CardRecurrence;
  /** Peso base del sorteo; el efectivo se recalcula con CardStats */
  baseWeight: number;
}

export interface CardAvailability {
  /** vacío/undefined = global (aparece en cualquier rama) */
  branchIds?: ID[];
  /** Etapas permitidas */
  minStageOrder?: number;
  maxStageOrder?: number;
  /** Condición arbitraria adicional (parámetros, flags, poderes, etc.) */
  conditions?: Condition;
  /** Solo puede sacarla este personaje si está habilitado */
  requireCharacterUnlocked?: boolean; // default true cuando hay characterId
}

export interface CardRecurrence {
  mode: 'once' | 'repeatable';
  /** Turnos mínimos antes de reaparecer */
  cooldownTurns?: number;
  /** Máximo de apariciones por partida */
  maxPerSession?: number;
}

export interface DecisionOption {
  id: ID;
  /** Orden de presentación */
  order: number;
  label: LocalizedText;
  /** Resultado narrativo opcional tras elegir */
  outcomeText?: LocalizedText;
  /**
   * "standard": opción normal con trade-off.
   * "balance": opción de equilibrio (poco costo, poco beneficio).
   */
  kind: 'standard' | 'balance';
  /** Efectos al elegir: sube unos parámetros y baja otros */
  effects: Effect[];
  /** Condición para que esté disponible (ej: has_power que habilita la balance) */
  availability?: Condition;
  /** Tag que un Power 'option_unlock' puede habilitar */
  unlockTag?: string;
  /** Qué mostrar si no está disponible */
  whenUnavailable: 'hide' | 'show_locked';
  /** Tags de amenaza que este resultado representa (para shields) */
  threatTags?: string[];
}

/* ============================================================
 * 5. ESTADO DEL JUGADOR (partida)
 * ============================================================ */

export interface GameSession extends Entity {
  userId: ID;
  gameId: ID;
  status: 'active' | 'won' | 'lost' | 'abandoned';
  endingKey?: string;
  locale: LocaleCode;

  turn: number;
  score: number;
  stageId: ID;
  branchIds: ID[];

  /** valor actual por parámetro */
  parameters: Record<ID, number>;
  activeParameterIds: ID[];
  unlockedCharacterIds: ID[];
  powers: { powerId: ID; charges: number }[];
  flags: Record<string, string | number | boolean>;
  earnedBadgeIds: ID[];

  /** Historial liviano por carta para reglas de recurrencia/cooldown */
  cardHistory: Record<ID, { count: number; lastTurn: number; lastOptionId?: ID }>;
  /** Cartas forzadas por efectos */
  cardQueue: { cardId: ID; dueTurn: number }[];
  currentCardId?: ID;
  /** Thresholds "once" ya disparados */
  firedThresholdIds: ID[];

  startedAt: ISODate;
  endedAt?: ISODate;
}

/* ============================================================
 * 6. ANALÍTICA Y FEEDBACK
 * ============================================================ */

/** Evento crudo: una fila por carta mostrada. Fuente de verdad para métricas. */
export interface CardImpression {
  id: ID;
  gameId: ID;
  cardId: ID;
  sessionId: ID;
  userId: ID;
  turn: number;
  stageId: ID;
  branchIds: ID[];
  shownAt: ISODate;
  /** undefined si abandonó sin elegir */
  chosenOptionId?: ID;
  responseTimeMs?: number;
  parametersBefore: Record<ID, number>;
  parametersAfter?: Record<ID, number>;
  /** ¿esta carta terminó la partida? (señal de dificultad excesiva) */
  causedGameOver: boolean;
  shieldUsedPowerId?: ID;
  availableOptionIds: ID[];
}

export interface CardFeedback {
  id: ID;
  cardId: ID;
  userId: ID;
  sessionId: ID;
  /** Positivo: tiene sentido / me gusta. Negativo: no encaja. */
  value: 'positive' | 'negative';
  reason?: 'too_hard' | 'too_easy' | 'unrealistic' | 'off_theme' | 'confusing' | 'other';
  comment?: string;
  createdAt: ISODate;
}

/** Agregado precalculado (se actualiza por job o incremental) */
export interface CardStats {
  cardId: ID;
  gameId: ID;
  impressions: number;
  optionChoiceCounts: Record<ID, number>;
  positiveVotes: number;
  negativeVotes: number;
  gameOverCount: number;
  avgResponseTimeMs: number;
  /** % de partidas que perdieron dentro de N turnos tras ver la carta */
  lossRateAfter: number;
  /** Dificultad observada vs. declarada */
  observedDifficulty: number;
  /** Peso final usado en el sorteo: baseWeight × f(feedback) × f(dificultad) */
  effectiveWeight: number;
  /** Flag para revisión del creador/moderador */
  needsReview: boolean;
  updatedAt: ISODate;
}

/* ============================================================
 * 7. USUARIOS Y AUTORÍA
 * ============================================================ */

export interface User extends Entity {
  email: string;
  displayName: string;
  locale: LocaleCode;
  /** Requerido (junto con estar autenticado) para crear cartas/juegos */
  isCreator: boolean;
}

/**
 * Permisos por juego. El dueño (Game.createdBy) tiene todos implícitamente.
 * Un creador solo puede agregar cartas a un juego ajeno si el dueño le dio
 * permiso 'contribute'. Sus cartas entran como in_review (o published si
 * el dueño le dio 'auto_publish').
 */
export type GamePermission =
  | 'contribute'    // crear cartas/personajes/assets en el juego
  | 'auto_publish'  // sus aportes se publican sin revisión
  | 'review'        // aprobar o rechazar aportes de otros
  | 'edit_game';    // editar parámetros, etapas, ramas

export interface GameCollaborator extends Entity {
  gameId: ID;
  userId: ID;
  permissions: GamePermission[];
  grantedBy: ID;
  status: 'invited' | 'active' | 'revoked';
}

/** Un creador solicita permiso al dueño de un juego ajeno */
export interface ContributionRequest extends Entity {
  gameId: ID;
  requesterId: ID;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  resolvedBy?: ID;
  resolvedAt?: ISODate;
}

/* ============================================================
 * 8. EJEMPLO DE EXTENSIÓN POR TIPO DE JUEGO
 * ============================================================ */

/**
 * Cada juego puede tipar su `metadata` sin tocar el modelo base.
 * Ejemplo para un manager de fútbol.
 */
export interface FootballManagerGameMeta {
  sport: 'football';
  seasonLengthMatches: number;
  currency: string;
}

export interface FootballManagerCharacterMeta {
  specialty: 'physical' | 'tactical' | 'medical' | 'press' | 'board';
}

export type FootballGame = Game & { metadata: FootballManagerGameMeta };
export type FootballCharacter = Character & { metadata: FootballManagerCharacterMeta };

/**
 * Ejemplo de definición (pseudo-datos) del threshold de un parámetro:
 *
 * fan_love: {
 *   min: 0, max: 100, initialValue: 50,
 *   thresholds: [
 *     { comparator: 'lte', value: 0,   effects: [{ type: 'end_game', outcome: 'defeat', endingKey: 'fired_by_fans', threatTags: ['internal_threat'] }] },
 *     { comparator: 'gte', value: 100, once: true, effects: [{ type: 'award_badge', badgeId: 'idol' }] }
 *   ]
 * }
 */

/* ============================================================
 * 9. ESTÉTICA
 * ============================================================ */

/** Para qué se genera un asset: determina plantilla de prompt y formato */
export type AssetPurpose =
  | 'card_illustration'
  | 'character_portrait'
  | 'icon'
  | 'badge'
  | 'cover'
  | 'background'
  | 'video'
  | 'animation';

/**
 * Perfil estético de un juego. Fuente única para: prompts de generación de imágenes,
 * colores, tipografías, estilo de íconos y movimiento.
 */
export interface AestheticProfile extends GameScoped {
  key: string;
  name: LocalizedText;
  /** Se incrementa en cada cambio relevante; los assets guardan con qué versión se generaron */
  version: number;
  artDirection: ArtDirection;
  tokens: DesignTokens;
  typography: Typography;
  iconStyle: IconStyle;
  /** Variaciones por rama o etapa (ej. la paleta cambia al entrar a una rama) */
  overrides?: ThemeOverride[];
}

/* ---------- 9.1 Dirección de arte (para generación de imágenes) ---------- */

export interface ArtDirection {
  /** Resumen legible para humanos (creadores, equipo) */
  styleSummary: string;
  /** Fragmento de prompt común a TODA imagen del juego */
  basePrompt: string;
  /** Negative prompt común */
  negativePrompt: string;
  /** Palabras clave de estilo (técnica, época, referentes genéricos) */
  keywords: string[];
  mood: string[];
  /** Descripción textual de la paleta para el prompt (ej. "neón cian y magenta sobre fondos oscuros") */
  paletteHint: string;
  /** Imágenes de referencia (consistencia): MediaAsset.id */
  referenceAssetIds?: ID[];
  /** Plantilla por tipo de asset. Placeholders: {{base}} {{subject}} {{character}} {{mood}} {{palette}} {{negative}} */
  templates: Partial<Record<AssetPurpose, PromptTemplate>>;
  /** Reglas que las imágenes deben respetar (encuadre, iluminación, qué evitar) */
  consistencyRules?: string[];
  recommendedModel?: string;
  /** Seed base opcional para mejorar consistencia */
  seed?: number;
}

export interface PromptTemplate {
  template: string;
  aspectRatio: string; // "16:9", "1:1", "3:4"
  size?: { width: number; height: number };
  extraNegative?: string;
}

/** Registro de cómo se creó un asset: permite reproducirlo o regenerarlo */
export interface AssetGeneration {
  source: 'ai' | 'manual' | 'upload';
  purpose: AssetPurpose;
  aestheticId: ID;
  aestheticVersion: number;
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  seed?: number;
  generatedAt: ISODate;
}

/* ---------- 9.2 Tokens de diseño ---------- */

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentContrast: string; // texto sobre accent
  positive: string;
  negative: string;
  warning: string;
  info: string;
  overlay: string;
}

export interface DesignTokens {
  defaultScheme: 'light' | 'dark';
  light?: ColorScheme;
  dark?: ColorScheme;
  /** Color propio por parámetro (barras, íconos, deltas) */
  parameterColors?: Record<ID, string>;
  radius: { sm: number; md: number; lg: number };
  borderWidth: number;
  spacingUnit: number; // px base
  shadows?: { card: string; modal: string };
  motion: {
    durationFast: number; // ms
    durationBase: number;
    durationSlow: number;
    easing: string; // cubic-bezier(...) o nombre CSS
    cardTransition: 'slide' | 'fade' | 'flip' | 'stack';
  };
}

/* ---------- 9.3 Tipografía ---------- */

export interface FontFace {
  family: string;
  source: 'google' | 'self_hosted' | 'system';
  url?: string; // self_hosted
  weights: number[];
  italic?: boolean;
  subsets?: string[]; // "latin", "latin-ext"...
  fallback: string[]; // stack de respaldo
  license?: string; // obligatorio para self_hosted
}

export type FontRole = 'display' | 'body' | 'accent';

export interface TypeStyle {
  font: FontRole;
  size: number; // px o rem según el cliente
  lineHeight: number;
  weight: number;
  letterSpacing?: number;
  uppercase?: boolean;
}

export interface Typography {
  /** Mínimo: display + body. Recomendado: accent para contraste (cifras, etiquetas, citas) */
  fonts: { display: FontFace; body: FontFace; accent?: FontFace };
  scale: {
    title: TypeStyle;
    cardText: TypeStyle;
    option: TypeStyle;
    label: TypeStyle;
    number: TypeStyle; // valores de parámetros
    caption: TypeStyle;
  };
  /** Sustituciones por idioma (ej. escrituras no latinas) */
  localeOverrides?: Record<LocaleCode, Partial<Typography['fonts']>>;
}

/* ---------- 9.4 Íconos ---------- */

export interface IconStyle {
  variant: 'line' | 'solid' | 'duotone' | 'pixel' | 'flat_color' | 'illustrated';
  /** Grilla base de diseño (ej. 24, 32, 64) */
  gridSize: number;
  strokeWidth?: number;
  corners?: 'round' | 'sharp';
  format: 'svg' | 'png' | 'lottie';
  /** currentColor = el ícono toma el color del contexto; palette = usa tokens; fixed = colores propios */
  colorMode: 'currentColor' | 'palette' | 'fixed';
  /** Cómo se describe un ícono al generarlo (se combina con ArtDirection.templates.icon) */
  generationNotes?: string;
}

export interface Icon extends GameScoped {
  key: string; // "fan_love", "squad_morale", "shield"
  label: LocalizedText; // accesibilidad (aria-label) y tooltip
  /** Uno de los dos: inline para SVG simples, o un asset */
  svg?: string;
  assetId?: ID;
  /** Conceptos que comunica; sirve para buscar/reutilizar y para fallback */
  semanticTags: string[];
  /** Variante opcional para estados (ej. parámetro en peligro) */
  states?: Partial<Record<'default' | 'danger' | 'full' | 'locked', { svg?: string; assetId?: ID }>>;
}

/* ---------- 9.5 Overrides ---------- */

export interface ThemeOverride {
  id: ID;
  /** Reusa el motor de condiciones: in_branch, stage_at_least, has_flag... */
  when: Condition;
  colors?: Partial<ColorScheme>;
  /** Texto que se agrega al basePrompt al generar assets de esa rama/etapa */
  artDirectionAppend?: string;
  cardTransition?: DesignTokens['motion']['cardTransition'];
}


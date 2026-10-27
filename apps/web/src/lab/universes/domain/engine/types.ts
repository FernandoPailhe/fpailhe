import type {
  AestheticProfile,
  Badge,
  Branch,
  CardImpression,
  CardStats,
  Character,
  DecisionOption,
  Game,
  GameSession,
  Icon,
  ID,
  ISODate,
  MediaAsset,
  Parameter,
  Power,
  SituationCard,
  Stage,
} from "../models";

export interface GameContent {
  game: Game;
  stages: Stage[]; // ordenadas por `order` asc
  branches: Branch[];
  parameters: Parameter[];
  characters: Character[];
  powers: Power[];
  badges: Badge[];
  icons: Icon[];
  assets: MediaAsset[];
  cards: SituationCard[]; // solo `status: "published"`, ya validadas
  aesthetic?: AestheticProfile;
}

export interface EngineContext {
  rng: () => number; // [0, 1)
  now: () => ISODate;
  newId: () => ID;
}

export type CardStatsMap = Readonly<Record<ID, CardStats>>;

/** 0 estricto … 4 último recurso. Ver "Reglas del motor", punto 9. */
export type RelaxationLevel = 0 | 1 | 2 | 3 | 4;

export type GameEvent =
  | { type: "parameter_changed"; parameterId: ID; from: number; to: number; delta: number }
  | { type: "parameter_activated"; parameterId: ID }
  | { type: "parameter_deactivated"; parameterId: ID }
  | { type: "score_changed"; from: number; to: number }
  | { type: "branch_entered"; branchId: ID }
  | { type: "branch_left"; branchId: ID }
  | { type: "character_unlocked"; characterId: ID }
  | { type: "character_locked"; characterId: ID }
  | { type: "power_granted"; powerId: ID; charges: number }
  | { type: "power_consumed"; powerId: ID; charges: number }
  | { type: "badge_awarded"; badgeId: ID }
  | { type: "stage_advanced"; stageId: ID }
  | { type: "threshold_fired"; parameterId: ID; thresholdId: ID }
  | { type: "shield_used"; powerId: ID; parameterId?: ID }
  | { type: "card_enqueued"; cardId: ID; dueTurn: number }
  | { type: "cascade_limit_reached" }
  | { type: "game_ended"; outcome: "victory" | "defeat"; endingKey?: string };

export interface OptionState {
  option: DecisionOption;
  state: "available" | "locked";
}

export interface BeginTurnResult {
  session: GameSession; // con `currentCardId` seteado; o terminada ('no_cards')
  card: SituationCard | null;
  relaxation: RelaxationLevel | "forced"; // "forced" = vino de `cardQueue`
}

export interface ResolveInput {
  optionId: ID;
  shownAt: ISODate;
  responseTimeMs?: number;
}

export interface ResolveResult {
  session: GameSession; // `currentCardId` limpio, `turn` +1, historial actualizado
  events: GameEvent[]; // en orden de ocurrencia, para la UI
  impression: CardImpression; // listo para registrar
  chosenOption: DecisionOption;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string; // ver task 05
  path: string; // ej. "cards[off_card_02].options[1].effects[0]"
  message: string;
}

/** Contenido crudo tal como sale de los JSON (ya tipado en el borde, ver tasks 06 y 07). */
export interface RawGameBundle {
  game: Game;
  stages: Stage[];
  branches: Branch[];
  parameters: Parameter[];
  characters: Character[];
  powers: Power[];
  badges: Badge[];
  icons: Icon[];
  assets: MediaAsset[];
  cards: SituationCard[];
  aesthetic?: AestheticProfile;
}

export interface RawCardCounters {
  impressions: number;
  optionChoiceCounts: Record<ID, number>;
  positiveVotes: number;
  negativeVotes: number;
  gameOverCount: number;
  responseTimeTotalMs: number;
}

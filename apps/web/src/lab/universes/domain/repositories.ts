import type {
  AestheticProfile,
  Badge,
  Branch,
  CardFeedback,
  CardImpression,
  Character,
  Game,
  GameSession,
  Icon,
  ID,
  MediaAsset,
  Parameter,
  Power,
  SituationCard,
  Stage,
} from "./models";
import type { RawCardCounters } from "./engine/types";

export interface GameContentRepository {
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getStages(gameId: ID): Promise<Stage[]>;
  getBranches(gameId: ID): Promise<Branch[]>;
  getParameters(gameId: ID): Promise<Parameter[]>;
  getCharacters(gameId: ID): Promise<Character[]>;
  getPowers(gameId: ID): Promise<Power[]>;
  getBadges(gameId: ID): Promise<Badge[]>;
  getIcons(gameId: ID): Promise<Icon[]>;
  getAssets(gameId: ID): Promise<MediaAsset[]>;
  getAesthetic(aestheticId: ID): Promise<AestheticProfile | undefined>;
}
export interface CardRepository {
  getPublishedCards(gameId: ID): Promise<SituationCard[]>;
  /** Contadores crudos por carta; el `CardStats` completo se deriva con `toCardStats` (necesita la carta). */
  getCardCounters(gameId: ID): Promise<(RawCardCounters & { cardId: ID })[]>;
}
export interface FeedbackRepository {
  submitFeedback(fb: CardFeedback): Promise<void>;
  recordImpression(imp: CardImpression): Promise<void>;
}
export interface SessionRepository {
  load(userId: ID, gameId: ID): Promise<GameSession | null>;
  save(session: GameSession): Promise<void>;
  clear(userId: ID, gameId: ID): Promise<void>;
}

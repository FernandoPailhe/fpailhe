import type {
  CardRepository,
  FeedbackRepository,
  GameContentRepository,
  SessionRepository,
} from "../domain/repositories";
import {
  createBundledCardRepository,
  createBundledGameContentRepository,
} from "./bundledContent";
import { createLocalSessionRepository } from "./localSessions";
import { createOfflineFeedbackRepository } from "./offlineRepositories";

export interface UniverseRepositories {
  content: GameContentRepository;
  cards: CardRepository;
  feedback: FeedbackRepository;
  sessions: SessionRepository;
}

let cached: UniverseRepositories | undefined;

/**
 * Fábrica memoizada de repositorios del módulo. Sin efectos al importar;
 * la rama Firebase, cuando exista, va dentro de esta fábrica.
 */
export function getUniverseRepositories(): UniverseRepositories {
  if (!cached) {
    cached = {
      content: createBundledGameContentRepository(),
      cards: createBundledCardRepository(),
      feedback: createOfflineFeedbackRepository(),
      sessions: createLocalSessionRepository(),
    };
  }
  return cached;
}

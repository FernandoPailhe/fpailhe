import type { DecisionOption, Game, GameSession, SituationCard, Stage } from "../models";
import type { EngineContext, GameContent } from "./types";
import { createSeededRng, createSequentialId } from "./rng";

/**
 * Helpers para tests del motor (y para la simulación del task 08).
 * No se exporta desde `engine/index.ts` a propósito.
 */

const T0 = "2026-01-01T00:00:00.000Z";

export function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: "s1",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    userId: "usr_test",
    gameId: "off_game_test",
    status: "active",
    locale: "es",
    turn: 0,
    score: 0,
    stageId: "off_stage_1",
    branchIds: [],
    parameters: {},
    activeParameterIds: [],
    unlockedCharacterIds: [],
    powers: [],
    flags: {},
    earnedBadgeIds: [],
    cardHistory: {},
    cardQueue: [],
    firedThresholdIds: [],
    startedAt: T0,
    ...overrides,
  };
}

export function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: "off_stage_1",
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    order: 1,
    name: { default: "Etapa 1" },
    minScore: 0,
    difficultyRange: { min: 1, max: 10 },
    ...overrides,
  };
}

export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    createdBy: "system",
    origin: "official",
    status: "published",
    slug: "test",
    kind: "test",
    title: { default: "Juego de prueba" },
    description: { default: "Test" },
    defaultLocale: "es",
    supportedLocales: ["es"],
    aestheticId: "off_aesthetic_test",
    visibility: "public",
    config: {
      recentCardsWindow: 3,
      initialActiveParameterIds: [],
      initialUnlockedCharacterIds: [],
      initialBranchIds: [],
      allowCardFeedback: false,
    },
    ...overrides,
  };
}

export function makeOption(overrides: Partial<DecisionOption> = {}): DecisionOption {
  return {
    id: "o1",
    order: 1,
    label: { default: "Opción" },
    kind: "standard",
    effects: [],
    whenUnavailable: "hide",
    ...overrides,
  };
}

export function makeCard(overrides: Partial<SituationCard> = {}): SituationCard {
  return {
    id: "off_card_1",
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    createdBy: "system",
    origin: "official",
    status: "published",
    text: { default: "Situación" },
    themeTags: [],
    difficulty: 5,
    options: [makeOption()],
    availability: {},
    recurrence: { mode: "repeatable" },
    baseWeight: 1,
    ...overrides,
  };
}

export function makeContent(overrides: Partial<GameContent> = {}): GameContent {
  return {
    game: makeGame(),
    stages: [
      makeStage({ id: "off_stage_1", order: 1 }),
      makeStage({ id: "off_stage_2", order: 2, minScore: 10 }),
    ],
    branches: [],
    parameters: [],
    characters: [],
    powers: [],
    badges: [],
    icons: [],
    assets: [],
    cards: [],
    ...overrides,
  };
}

/** EngineContext determinista para tests. */
export function makeEngineContext(overrides: Partial<EngineContext> = {}): EngineContext {
  let tick = 0;
  return {
    rng: createSeededRng(1),
    now: () => new Date(Date.parse(T0) + tick++ * 1000).toISOString(),
    newId: createSequentialId("test"),
    ...overrides,
  };
}

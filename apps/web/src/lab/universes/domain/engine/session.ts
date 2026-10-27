import type { GameSession, ID, LocaleCode } from "../models";
import { NARRATIVES_SCHEMA_VERSION } from "../constants";
import { applyEffects } from "./effects";
import { settleThresholds } from "./thresholds";
import type { EngineContext, GameContent } from "./types";

/**
 * Crea una partida nueva desde `GameConfig` (spec §5.1) y "entra" a la etapa
 * inicial: activa sus parámetros, corre `onEnter` y evalúa thresholds.
 */
export function createSession(
  content: GameContent,
  init: { userId: ID; locale: LocaleCode },
  ec: EngineContext,
): GameSession {
  const { config } = content.game;
  const stages = [...content.stages].sort((a, b) => a.order - b.order);
  const first = stages[0];
  if (!first) throw new Error(`createSession: el juego ${content.game.id} no tiene etapas`);

  const now = ec.now();
  let session: GameSession = {
    id: ec.newId(),
    schemaVersion: NARRATIVES_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    userId: init.userId,
    gameId: content.game.id,
    status: "active",
    locale: init.locale,
    turn: 0,
    score: 0,
    stageId: first.id,
    branchIds: [...config.initialBranchIds],
    parameters: Object.fromEntries(content.parameters.map((p) => [p.id, p.initialValue])),
    activeParameterIds: [...config.initialActiveParameterIds],
    unlockedCharacterIds: [
      ...new Set([
        ...config.initialUnlockedCharacterIds,
        ...content.characters.filter((c) => c.unlockedByDefault).map((c) => c.id),
      ]),
    ],
    powers: (config.initialPowers ?? []).map((p) => ({ ...p })),
    flags: {},
    earnedBadgeIds: [],
    cardHistory: {},
    cardQueue: [],
    firedThresholdIds: [],
    startedAt: now,
  };

  const entry = applyEffects(
    content,
    session,
    [
      ...(first.activatesParameterIds ?? []).map(
        (parameterId): Parameters<typeof applyEffects>[2][number] => ({
          type: "activate_parameter",
          parameterId,
        }),
      ),
      ...(first.onEnter ?? []),
    ],
    ec,
  );
  session = settleThresholds(content, entry.session, ec).session;
  session.updatedAt = ec.now();
  return session;
}

/** Marca la partida como abandonada (spec §5.2 cierre no natural). */
export function abandonSession(session: GameSession, ec: EngineContext): GameSession {
  const next = structuredClone(session);
  next.status = "abandoned";
  next.endedAt = ec.now();
  next.currentCardId = undefined;
  next.updatedAt = ec.now();
  return next;
}

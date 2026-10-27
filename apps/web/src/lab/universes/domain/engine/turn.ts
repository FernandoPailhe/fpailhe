import type { CardImpression, GameSession } from "../models";
import { applyEffects } from "./effects";
import { listOptions } from "./options";
import { settleThresholds } from "./thresholds";
import { advanceStageIfReady, unlockCharactersByCondition } from "./stages";
import type { EngineContext, GameContent, GameEvent, ResolveInput, ResolveResult } from "./types";

/**
 * Resuelve la decisión del jugador (regla 1 del plan):
 * efectos → thresholds → desbloqueos → etapa → historial → turn+1 → impression.
 */
export function resolveChoice(
  content: GameContent,
  session: GameSession,
  input: ResolveInput,
  ec: EngineContext,
): ResolveResult {
  if (session.status !== "active") {
    throw new Error(`resolveChoice: la sesión ${session.id} no está activa (${session.status})`);
  }
  const cardId = session.currentCardId;
  if (!cardId) throw new Error(`resolveChoice: la sesión ${session.id} no tiene carta actual`);
  const card = content.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`resolveChoice: la carta ${cardId} no existe en el contenido`);
  const option = card.options.find((o) => o.id === input.optionId);
  if (!option) throw new Error(`resolveChoice: la opción ${input.optionId} no existe en ${cardId}`);
  const optionStates = listOptions(card, session, content);
  const optionState = optionStates.find((o) => o.option.id === input.optionId);
  if (!optionState || optionState.state !== "available") {
    throw new Error(`resolveChoice: la opción ${input.optionId} no está disponible`);
  }

  const before = structuredClone(session);
  let next = structuredClone(session);
  const events: GameEvent[] = [];
  const opts = { threatTags: option.threatTags };

  const fx = applyEffects(content, next, option.effects, ec, opts);
  next = fx.session;
  events.push(...fx.events);

  if (next.status === "active") {
    const settled = settleThresholds(content, next, ec, opts);
    next = settled.session;
    events.push(...settled.events);
  }

  if (next.status === "active") {
    const unlocked = unlockCharactersByCondition(content, next, ec);
    next = unlocked.session;
    events.push(...unlocked.events);
  }

  if (next.status === "active") {
    const advanced = advanceStageIfReady(content, next, ec);
    next = advanced.session;
    events.push(...advanced.events);
  }

  const prevSeen = next.cardHistory[cardId];
  next.cardHistory[cardId] = {
    count: (prevSeen?.count ?? 0) + 1,
    lastTurn: session.turn,
    lastOptionId: input.optionId,
  };
  next.turn += 1;
  next.currentCardId = undefined;
  next.updatedAt = ec.now();

  const shieldEvent = events.find((e): e is Extract<GameEvent, { type: "shield_used" }> => e.type === "shield_used");
  const impression: CardImpression = {
    id: ec.newId(),
    gameId: next.gameId,
    cardId,
    sessionId: next.id,
    userId: next.userId,
    turn: before.turn,
    stageId: before.stageId,
    branchIds: [...before.branchIds],
    shownAt: input.shownAt,
    chosenOptionId: input.optionId,
    responseTimeMs: input.responseTimeMs,
    parametersBefore: before.parameters,
    parametersAfter: next.parameters,
    causedGameOver: before.status === "active" && next.status === "lost",
    shieldUsedPowerId: shieldEvent?.powerId,
    availableOptionIds: optionStates.filter((o) => o.state === "available").map((o) => o.option.id),
  };

  return { session: next, events, impression, chosenOption: option };
}

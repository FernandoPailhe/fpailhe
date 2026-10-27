import type { CardImpression, GameSession, ID, LocaleCode } from "../domain/models";
import { abandonSession, createSession } from "../domain/engine/session";
import { beginTurn } from "../domain/engine/selection";
import { resolveChoice } from "../domain/engine/turn";
import type { EngineContext, GameContent, ResolveInput } from "../domain/engine/types";
import type { LastResolution } from "./store/sessionStore";

export interface StartResult {
  session: GameSession; // con carta inicial (o 'lost' si no hay cartas)
}

export function startNewGameTransition(
  content: GameContent,
  init: { userId: ID; locale: LocaleCode },
  ec: EngineContext,
): StartResult {
  const fresh = createSession(content, init, ec);
  const begun = beginTurn(content, fresh, {}, ec);
  return { session: begun.session };
}

export interface ChooseResult {
  session: GameSession;
  resolution: LastResolution;
  impression: CardImpression;
}

export function chooseTransition(
  content: GameContent,
  session: GameSession,
  input: ResolveInput,
  ec: EngineContext,
): ChooseResult {
  const result = resolveChoice(content, session, input, ec);
  return {
    session: result.session,
    resolution: {
      cardId: session.currentCardId!,
      optionId: input.optionId,
      events: result.events,
      parametersBefore: session.parameters,
      feedbackSent: false,
    },
    impression: result.impression,
  };
}

export interface NextResult {
  session: GameSession; // con carta nueva, o terminada
}

export function nextTransition(
  content: GameContent,
  session: GameSession,
  ec: EngineContext,
): NextResult {
  if (session.status !== "active") return { session };
  const begun = beginTurn(content, session, {}, ec);
  return { session: begun.session };
}

export function abandonTransition(session: GameSession, ec: EngineContext): GameSession {
  return abandonSession(session, ec);
}

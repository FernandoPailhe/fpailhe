import type { GameSession, SituationCard } from "../models";
import { evaluateCondition } from "./conditions";
import { listOptions } from "./options";
import { computeEffectiveWeight } from "./weights";
import type {
  BeginTurnResult,
  CardStatsMap,
  EngineContext,
  GameContent,
  RelaxationLevel,
} from "./types";

interface RelaxationFlags {
  ignoreRecent: boolean;
  ignoreCooldown: boolean;
  widenDifficulty: boolean;
  ignoreStageAndDifficulty: boolean;
}

/** Regla 9: qué se relaja en cada nivel. `once`/`maxPerSession` nunca se relajan. */
const RELAXATION: Record<RelaxationLevel, RelaxationFlags> = {
  0: { ignoreRecent: false, ignoreCooldown: false, widenDifficulty: false, ignoreStageAndDifficulty: false },
  1: { ignoreRecent: true, ignoreCooldown: false, widenDifficulty: false, ignoreStageAndDifficulty: false },
  2: { ignoreRecent: true, ignoreCooldown: true, widenDifficulty: false, ignoreStageAndDifficulty: false },
  3: { ignoreRecent: true, ignoreCooldown: true, widenDifficulty: true, ignoreStageAndDifficulty: false },
  4: { ignoreRecent: true, ignoreCooldown: true, widenDifficulty: true, ignoreStageAndDifficulty: true },
};

export function isCardEligible(
  card: SituationCard,
  session: GameSession,
  content: GameContent,
  level: RelaxationLevel,
): boolean {
  const flags = RELAXATION[level];
  const stage = content.stages.find((s) => s.id === session.stageId);

  // Rama: global o intersecta
  const branchOk =
    !card.availability.branchIds?.length ||
    card.availability.branchIds.some((b) => session.branchIds.includes(b));
  if (!branchOk) return false;

  // Etapa y dificultad
  if (!flags.ignoreStageAndDifficulty) {
    if (!stage) return false;
    if (card.availability.minStageOrder !== undefined && stage.order < card.availability.minStageOrder)
      return false;
    if (card.availability.maxStageOrder !== undefined && stage.order > card.availability.maxStageOrder)
      return false;
    const range = stage.difficultyRange;
    const min = flags.widenDifficulty ? Math.max(1, range.min - 1) : range.min;
    const max = flags.widenDifficulty ? Math.min(10, range.max + 1) : range.max;
    if (card.difficulty < min || card.difficulty > max) return false;
  }

  // Condiciones arbitrarias
  if (!evaluateCondition(card.availability.conditions, session, content)) return false;

  // Personaje
  if (
    card.characterId !== undefined &&
    card.availability.requireCharacterUnlocked !== false &&
    !session.unlockedCharacterIds.includes(card.characterId)
  ) {
    return false;
  }

  // Recurrencia: once y maxPerSession nunca se relajan
  const seen = session.cardHistory[card.id];
  if (card.recurrence.mode === "once" && seen) return false;
  if (card.recurrence.maxPerSession !== undefined && (seen?.count ?? 0) >= card.recurrence.maxPerSession)
    return false;
  if (
    !flags.ignoreCooldown &&
    card.recurrence.mode === "repeatable" &&
    card.recurrence.cooldownTurns !== undefined &&
    seen &&
    session.turn - seen.lastTurn <= card.recurrence.cooldownTurns
  ) {
    return false;
  }

  // Ventana de recientes
  if (
    !flags.ignoreRecent &&
    seen &&
    session.turn - seen.lastTurn <= content.game.config.recentCardsWindow
  ) {
    return false;
  }

  // Al menos una opción disponible
  return listOptions(card, session, content).some((o) => o.state === "available");
}

export interface Selection {
  card: SituationCard;
  relaxation: RelaxationLevel;
}

/** Sorteo ponderado del pool elegible con relajación progresiva (regla 9). */
export function selectNextCard(
  content: GameContent,
  session: GameSession,
  stats: CardStatsMap,
  ec: EngineContext,
): Selection | null {
  const levels: RelaxationLevel[] = [0, 1, 2, 3, 4];
  for (const level of levels) {
    const pool = content.cards.filter((c) => isCardEligible(c, session, content, level));
    if (pool.length === 0) continue;
    const weights = pool.map((c) => Math.max(0, computeEffectiveWeight(c, stats[c.id])));
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      const picked = pool[Math.min(pool.length - 1, Math.floor(ec.rng() * pool.length))];
      return picked ? { card: picked, relaxation: level } : null;
    }
    let r = ec.rng() * sum;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i] ?? 0;
      if (r < 0) {
        const card = pool[i];
        return card ? { card, relaxation: level } : null;
      }
    }
    const last = pool[pool.length - 1];
    return last ? { card: last, relaxation: level } : null;
  }
  return null;
}

/**
 * Inicia un turno: primero la cola forzada, luego el sorteo (regla 9).
 * Devuelve la sesión con `currentCardId` o terminada en `no_cards`.
 */
export function beginTurn(
  content: GameContent,
  session: GameSession,
  stats: CardStatsMap,
  ec: EngineContext,
): BeginTurnResult {
  const next = structuredClone(session);

  // Cola forzada: menor dueTurn <= turn (desempate: orden de inserción — sort estable)
  const due = next.cardQueue
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.dueTurn <= next.turn)
    .sort((a, b) => a.entry.dueTurn - b.entry.dueTurn || a.index - b.index);

  for (const { entry } of due) {
    next.cardQueue = next.cardQueue.filter((q) => q !== entry);
    const card = content.cards.find((c) => c.id === entry.cardId);
    if (!card) continue; // descartada: ya no existe
    if (!listOptions(card, next, content).some((o) => o.state === "available")) continue; // descartada
    next.currentCardId = card.id;
    next.updatedAt = ec.now();
    return { session: next, card, relaxation: "forced" };
  }

  const selection = selectNextCard(content, next, stats, ec);
  if (!selection) {
    next.status = "lost";
    next.endingKey = "no_cards";
    next.endedAt = ec.now();
    next.currentCardId = undefined;
    next.updatedAt = ec.now();
    return { session: next, card: null, relaxation: 4 };
  }

  next.currentCardId = selection.card.id;
  next.updatedAt = ec.now();
  return { session: next, card: selection.card, relaxation: selection.relaxation };
}

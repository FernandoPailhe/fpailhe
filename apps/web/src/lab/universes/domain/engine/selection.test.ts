import { describe, expect, it } from "vitest";
import type { Character } from "../models";
import { beginTurn, isCardEligible, selectNextCard } from "./selection";
import {
  makeCard,
  makeContent,
  makeEngineContext,
  makeOption,
  makeSession,
} from "./testing";

const T0 = "2026-01-01T00:00:00.000Z";
const stats = {};
const ec = () => makeEngineContext();

function char(id: string): Character {
  return {
    id,
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: id,
    name: { default: id },
    themeTags: [],
    unlockedByDefault: false,
  };
}

describe("isCardEligible — filtros básicos", () => {
  it("carta global (sin branchIds) siempre pasa el filtro de rama", () => {
    const card = makeCard();
    expect(isCardEligible(card, makeSession({ branchIds: ["b1"] }), makeContent(), 0)).toBe(true);
  });

  it("carta de rama solo si la rama está activa", () => {
    const card = makeCard({ availability: { branchIds: ["b1"] } });
    const content = makeContent();
    expect(isCardEligible(card, makeSession({ branchIds: ["b1"] }), content, 0)).toBe(true);
    expect(isCardEligible(card, makeSession({ branchIds: ["b2"] }), content, 0)).toBe(false);
    expect(isCardEligible(card, makeSession({ branchIds: [] }), content, 0)).toBe(false);
  });

  it("minStageOrder / maxStageOrder contra la etapa actual", () => {
    const card = makeCard({ availability: { minStageOrder: 2, maxStageOrder: 3 } });
    const content = makeContent(); // stage 1 (order 1) y stage 2 (order 2)
    expect(isCardEligible(card, makeSession({ stageId: "off_stage_1" }), content, 0)).toBe(false);
    expect(isCardEligible(card, makeSession({ stageId: "off_stage_2" }), content, 0)).toBe(true);
  });

  it("dificultad dentro del difficultyRange de la etapa", () => {
    const content = makeContent({
      stages: [
        {
          ...makeContent().stages[0]!,
          id: "off_stage_1",
          order: 1,
          difficultyRange: { min: 1, max: 3 },
        },
      ],
    });
    const easy = makeCard({ difficulty: 2 });
    const hard = makeCard({ difficulty: 8 });
    const session = makeSession({ stageId: "off_stage_1" });
    expect(isCardEligible(easy, session, content, 0)).toBe(true);
    expect(isCardEligible(hard, session, content, 0)).toBe(false);
  });

  it("conditions arbitrarias", () => {
    const card = makeCard({
      availability: { conditions: { type: "has_flag", flag: "x" } },
    });
    const content = makeContent();
    expect(isCardEligible(card, makeSession({ flags: { x: 1 } }), content, 0)).toBe(true);
    expect(isCardEligible(card, makeSession(), content, 0)).toBe(false);
  });

  it("personaje bloqueado impide la carta (salvo requireCharacterUnlocked:false)", () => {
    const card = makeCard({ characterId: "c1" });
    const free = makeCard({ characterId: "c1", availability: { requireCharacterUnlocked: false } });
    const content = makeContent({ characters: [char("c1")] });
    expect(isCardEligible(card, makeSession(), content, 0)).toBe(false);
    expect(isCardEligible(card, makeSession({ unlockedCharacterIds: ["c1"] }), content, 0)).toBe(true);
    expect(isCardEligible(free, makeSession(), content, 0)).toBe(true);
  });

  it("carta sin opciones disponibles no es elegible", () => {
    const card = makeCard({
      options: [
        makeOption({
          availability: { type: "has_flag", flag: "nope" },
          whenUnavailable: "show_locked",
        }),
      ],
    });
    expect(isCardEligible(card, makeSession(), makeContent(), 0)).toBe(false);
  });
});

describe("isCardEligible — recurrencia y recientes", () => {
  const seen = (lastTurn: number, count = 1) => ({
    cardHistory: { c1: { count, lastTurn, lastOptionId: "o1" } },
  });

  it("once no vuelve a salir nunca", () => {
    const card = makeCard({ id: "c1", recurrence: { mode: "once" } });
    const session = makeSession({ turn: 20, ...seen(0) });
    for (const level of [0, 1, 2, 3, 4] as const) {
      expect(isCardEligible(card, session, makeContent(), level)).toBe(false);
    }
  });

  it("repeatable respeta cooldownTurns y se relaja en nivel 2", () => {
    const card = makeCard({ id: "c1", recurrence: { mode: "repeatable", cooldownTurns: 5 } });
    const session = makeSession({ turn: 10, ...seen(8) });
    expect(isCardEligible(card, session, makeContent(), 0)).toBe(false); // 2 ≤ 5
    expect(isCardEligible(card, session, makeContent(), 1)).toBe(false);
    expect(isCardEligible(card, session, makeContent(), 2)).toBe(true);
    const later = makeSession({ turn: 14, ...seen(8) });
    expect(isCardEligible(card, later, makeContent(), 0)).toBe(true); // 6 > 5
  });

  it("maxPerSession nunca se relaja", () => {
    const card = makeCard({ id: "c1", recurrence: { mode: "repeatable", maxPerSession: 2 } });
    const session = makeSession({ turn: 30, ...seen(0, 2) });
    for (const level of [0, 1, 2, 3, 4] as const) {
      expect(isCardEligible(card, session, makeContent(), level)).toBe(false);
    }
  });

  it("ventana de recientes (recentCardsWindow) y relajación nivel 1", () => {
    const card = makeCard({ id: "c1" });
    // makeGame: recentCardsWindow = 3
    const session = makeSession({ turn: 10, ...seen(8) }); // 2 ≤ 3 → reciente
    expect(isCardEligible(card, session, makeContent(), 0)).toBe(false);
    expect(isCardEligible(card, session, makeContent(), 1)).toBe(true);
    const older = makeSession({ turn: 12, ...seen(8) }); // 4 > 3 → ya no
    expect(isCardEligible(card, older, makeContent(), 0)).toBe(true);
  });

  it("nivel 3 amplía el rango de dificultad ±1", () => {
    const content = makeContent({
      stages: [
        {
          ...makeContent().stages[0]!,
          id: "off_stage_1",
          order: 1,
          difficultyRange: { min: 3, max: 5 },
        },
      ],
    });
    const card = makeCard({ difficulty: 6 });
    const session = makeSession({ stageId: "off_stage_1" });
    expect(isCardEligible(card, session, content, 0)).toBe(false);
    expect(isCardEligible(card, session, content, 2)).toBe(false);
    expect(isCardEligible(card, session, content, 3)).toBe(true);
  });

  it("nivel 4 ignora etapa y dificultad pero no lo demás", () => {
    const content = makeContent({
      stages: [
        {
          ...makeContent().stages[0]!,
          id: "off_stage_1",
          order: 1,
          difficultyRange: { min: 1, max: 2 },
        },
      ],
    });
    const card = makeCard({
      difficulty: 10,
      availability: { minStageOrder: 5, branchIds: ["b1"] },
    });
    const session = makeSession({ stageId: "off_stage_1", branchIds: ["b1"] });
    expect(isCardEligible(card, session, content, 0)).toBe(false);
    expect(isCardEligible(card, session, content, 4)).toBe(true);
    // la rama sigue exigiéndose
    expect(isCardEligible(card, makeSession({ branchIds: [] }), content, 4)).toBe(false);
  });
});

describe("selectNextCard / beginTurn", () => {
  it("pool vacío en todos los niveles → null", () => {
    const content = makeContent({ cards: [] });
    expect(selectNextCard(content, makeSession(), stats, ec())).toBeNull();
  });

  it("como hay una sola carta elegible la elige en nivel 0", () => {
    const card = makeCard({ id: "c1" });
    const content = makeContent({ cards: [card, makeCard({ id: "c2", difficulty: 10 })] });
    const content2 = {
      ...content,
      stages: [{ ...content.stages[0]!, difficultyRange: { min: 1, max: 5 } }],
    };
    const sel = selectNextCard(content2, makeSession(), stats, ec());
    expect(sel?.card.id).toBe("c1");
    expect(sel?.relaxation).toBe(0);
  });

  it("pesos ≤ 0 se tratan como 0; todos 0 → uniforme", () => {
    const cards = [makeCard({ id: "c1", baseWeight: 0 }), makeCard({ id: "c2", baseWeight: 0 })];
    const content = makeContent({ cards });
    const sel = selectNextCard(content, makeSession(), stats, ec());
    expect(sel?.card).toBeDefined();
  });

  it("beginTurn toma la cola forzada antes que el pool", () => {
    const queued = makeCard({ id: "forced" });
    const content = makeContent({ cards: [queued, makeCard({ id: "c2" })] });
    const session = makeSession({
      turn: 5,
      cardQueue: [{ cardId: "forced", dueTurn: 5 }],
    });
    const result = beginTurn(content, session, stats, ec());
    expect(result.card?.id).toBe("forced");
    expect(result.relaxation).toBe("forced");
    expect(result.session.currentCardId).toBe("forced");
    expect(result.session.cardQueue).toHaveLength(0);
  });

  it("la cola respeta dueTurn y descarta cartas inválidas", () => {
    const content = makeContent({ cards: [makeCard({ id: "ok" })] });
    const session = makeSession({
      turn: 5,
      cardQueue: [
        { cardId: "futura", dueTurn: 9 }, // aún no
        { cardId: "borrada", dueTurn: 1 }, // ya no existe → descartar
        { cardId: "ok", dueTurn: 3 },
      ],
    });
    const result = beginTurn(content, session, stats, ec());
    expect(result.card?.id).toBe("ok");
    expect(result.session.cardQueue).toEqual([{ cardId: "futura", dueTurn: 9 }]);
  });

  it("carta en cola sin opciones disponibles se descarta", () => {
    const locked = makeCard({
      id: "locked",
      options: [
        makeOption({
          availability: { type: "has_flag", flag: "nope" },
          whenUnavailable: "show_locked",
        }),
      ],
    });
    const content = makeContent({ cards: [locked, makeCard({ id: "fallback" })] });
    const session = makeSession({
      turn: 1,
      cardQueue: [{ cardId: "locked", dueTurn: 1 }],
    });
    const result = beginTurn(content, session, stats, ec());
    expect(result.card?.id).toBe("fallback");
    expect(result.session.cardQueue).toHaveLength(0);
  });

  it("sin cartas elegibles → status lost con endingKey no_cards", () => {
    const content = makeContent({ cards: [] });
    const result = beginTurn(content, makeSession(), stats, ec());
    expect(result.card).toBeNull();
    expect(result.session.status).toBe("lost");
    expect(result.session.endingKey).toBe("no_cards");
    expect(result.session.endedAt).toBeDefined();
  });

  it("setea currentCardId sin mutar la sesión original", () => {
    const session = makeSession();
    const result = beginTurn(makeContent({ cards: [makeCard()] }), session, stats, ec());
    expect(result.session.currentCardId).toBe("off_card_1");
    expect(session.currentCardId).toBeUndefined();
  });
});

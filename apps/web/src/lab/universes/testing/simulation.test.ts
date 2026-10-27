import { describe, expect, it } from "vitest";
import { assembleGameContent } from "../domain/engine/content";
import { createSequentialId, createSeededRng } from "../domain/engine/rng";
import { listOptions } from "../domain/engine/options";
import { beginTurn } from "../domain/engine/selection";
import { createSession } from "../domain/engine/session";
import { resolveChoice } from "../domain/engine/turn";
import type { EngineContext, GameContent } from "../domain/engine/types";
import type { DecisionOption, GameSession, ID } from "../domain/models";
import { loadAllBundles } from "./loadAllBundles";

const MAX_TURNS = 500;
const SEED_COUNT = 200;

function ctxOf(seed: number): EngineContext {
  return {
    rng: createSeededRng(seed),
    now: () => "2026-01-01T00:00:00.000Z",
    newId: createSequentialId(`sim_${seed}_`),
  };
}

type Policy = "first" | "last" | "random" | "greedy";

/** Política voraz: la opción con mayor suma de deltas positivos en parámetros activos. */
function greedyScore(option: DecisionOption, session: GameSession): number {
  let score = 0;
  for (const e of option.effects) {
    if (e.type === "modify_parameter" && session.activeParameterIds.includes(e.parameterId))
      score += Math.max(0, e.delta);
    if (e.type === "set_parameter" && session.activeParameterIds.includes(e.parameterId))
      score += Math.max(0, e.value - (session.parameters[e.parameterId] ?? 0));
    if (e.type === "add_score") score += e.points * 0.5;
  }
  return score;
}

function pickOption(
  policy: Policy,
  available: DecisionOption[],
  session: GameSession,
  ec: EngineContext,
): DecisionOption {
  switch (policy) {
    case "first":
      return available[0]!;
    case "last":
      return available[available.length - 1]!;
    case "random":
      return available[Math.floor(ec.rng() * available.length)]!;
    case "greedy": {
      let best = available[0]!;
      let bestScore = -Infinity;
      for (const o of available) {
        const s = greedyScore(o, session);
        if (s > bestScore) {
          bestScore = s;
          best = o;
        }
      }
      return best;
    }
  }
}

interface RunResult {
  session: GameSession;
  cardIds: ID[];
}

function play(content: GameContent, seed: number, policy: Policy): RunResult {
  const ec = ctxOf(seed);
  let session = createSession(content, { userId: "sim_user", locale: "es" }, ec);
  const cardIds: ID[] = [];
  let turns = 0;
  while (session.status === "active" && turns < MAX_TURNS) {
    const begun = beginTurn(content, session, {}, ec);
    session = begun.session;
    if (!begun.card) break;
    cardIds.push(begun.card.id);
    const available = listOptions(begun.card, session, content)
      .filter((o) => o.state === "available")
      .map((o) => o.option);
    if (available.length === 0)
      throw new Error(`carta ${begun.card.id} sin opciones disponibles en seed ${seed}`);
    const option = pickOption(policy, available, session, ec);
    session = resolveChoice(
      content,
      session,
      { optionId: option.id, shownAt: ec.now() },
      ec,
    ).session;
    turns++;
  }
  if (session.status === "active")
    throw new Error(`partida no terminó en ${MAX_TURNS} turnos (seed ${seed}, ${policy})`);
  return { session, cardIds };
}

const bundles = loadAllBundles();

for (const { slug, raw } of bundles) {
  describe(`simulación: ${slug}`, () => {
    const content = assembleGameContent(raw);
    const policies: Policy[] = ["first", "last", "random"];

    const outcomes: Record<string, number> = {};
    for (const policy of policies) {
      it(`política ${policy}: 200 semillas terminan sin atascarse ni lanzar`, () => {
        for (let seed = 0; seed < SEED_COUNT; seed++) {
          const { session } = play(content, seed, policy);
          expect(session.status).not.toBe("active");
          if (session.endingKey) {
            const endings =
              (content.game.metadata as { endings?: Record<string, unknown> } | undefined)
                ?.endings ?? {};
            expect(
              Object.keys(endings),
              `endingKey "${session.endingKey}" sin entrada en metadata.endings`,
            ).toContain(session.endingKey);
          }
          outcomes[`${policy}:${session.status}`] =
            (outcomes[`${policy}:${session.status}`] ?? 0) + 1;
        }
      });
    }

    it("la misma semilla reproduce la misma secuencia de cartas", () => {
      for (const seed of [0, 7, 42, 133]) {
        for (const policy of policies) {
          const a = play(content, seed, policy);
          const b = play(content, seed, policy);
          expect(b.cardIds).toEqual(a.cardIds);
        }
      }
    });

    if (slug === "demo-reino") {
      it("se alcanza al menos una derrota y una victoria", () => {
        const results = new Set<string>();
        for (let seed = 0; seed < SEED_COUNT; seed++) {
          for (const policy of [...policies, "greedy"] as Policy[]) {
            results.add(play(content, seed, policy).session.status);
          }
        }
        console.info(`demo-reino resultados:`, Object.fromEntries(
          Object.entries(results).map(([k]) => [k, 1]),
        ), outcomes);
        expect(results.has("lost")).toBe(true);
        expect(results.has("won")).toBe(true);
      });
    }
  });
}

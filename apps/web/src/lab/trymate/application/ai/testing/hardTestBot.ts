import type { ComputerPlayer } from "../ComputerPlayer";
import { createEasyBot } from "../EasyBot";
import { createMediumBot } from "../MediumBot";
import type { Personality } from "../personality";
import type { Rng } from "../rng";
import { createHardBot } from "../hard/HardBot";

/**
 * Fábricas de bots para tests/arena. Hard corre determinista: forceInline +
 * presupuesto en nodos (sin worker, sin reloj). Solo importable desde tests
 * y herramientas dev — nunca desde código de producción.
 */

export const TEST_NODES = 5_000;
// El planning necesita ~8×1500 para rendir como el greedy de Medium; a
// 4×200 sus evaluaciones de ejército son ruido y NET-negativas (medido:
// 53% vs 67% pareadas). Producción usa 24×3000.
export const TEST_SETUP = { candidates: 8, nodesPerEval: 1_500 };

export function hardFactory(
  personality: Personality = "balanced",
  nodes = TEST_NODES,
): (rng: Rng) => ComputerPlayer {
  return (rng: Rng) =>
    createHardBot(rng, {
      personality,
      forceInline: true,
      overrides: {
        budget: { kind: "nodes", n: nodes },
        fallbackBudget: { kind: "nodes", n: nodes },
        setupBudget: TEST_SETUP,
        inlineSetupBudget: TEST_SETUP,
      },
    });
}

export const mediumFactory = (rng: Rng): ComputerPlayer => createMediumBot(rng);
export const easyFactory = (rng: Rng): ComputerPlayer => createEasyBot(rng);

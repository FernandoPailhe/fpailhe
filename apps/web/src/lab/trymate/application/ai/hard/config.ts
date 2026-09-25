import type { SearchBudget } from "./search";

export interface SetupBudget {
  candidates: number;
  nodesPerEval: number;
}

/** Config del nivel Hard: presupuesto, profundidad y podas de la búsqueda. */
export const HARD_BOT_CONFIG = {
  budget: { kind: "time", ms: 800 } as SearchBudget,
  fallbackBudget: { kind: "nodes", n: 60_000 } as SearchBudget, // sin worker
  maxDepth: 12,
  aspiration: 50,
  benchTopK: 3,
  qMaxPlies: 6,
  lmr: { minDepth: 3, minIndex: 4 },
  killersPerPly: 2,
  clockCheckEvery: 64,
  tieWindow: 1,
  /** Muestreo de ejércitos para el setup (worker / inline). */
  setupBudget: { candidates: 24, nodesPerEval: 3_000 } as SetupBudget,
  inlineSetupBudget: { candidates: 8, nodesPerEval: 800 } as SetupBudget,
};

export type HardBotConfig = typeof HARD_BOT_CONFIG;

export type EvalTerm =
  | "points"
  | "material"
  | "progress"
  | "hanging"
  | "cohesion"
  | "containment"
  | "runnerThreat"
  | "freeLane"
  | "mobility";

export type TermWeights = Record<EvalTerm, number>;

export type Posture = "ATTACK" | "DEFEND" | "BALANCED";

/**
 * Pesos del Medium: números adimensionales. Los umbrales que dependen del
 * tablero viven en `insight.geometry` (derivados); los valores por tipo en
 * `insight.profiles` (sondeados). `valueOverrides` solo existe para ajustar
 * a mano el valor de un tipo (por nombre) si hiciera falta.
 */
export const MEDIUM_BOT_CONFIG = {
  valueOverrides: {} as Partial<Record<string, number>>,
  benchFactor: 0.8,
  pointValue: 400,
  winValue: 100_000,
  runner: { base: 60, exponent: 1.3, threatFactor: 1.5 },
  hanging: { undefended: 0.9, defended: 0.25, sideToMoveFactor: 0.5 },
  cohesion: { supported: 6, isolated: -8, stretchPerRow: -5 },
  containment: { perAdvanceMove: -1, plugged: 12, fullyControlled: 8 },
  freeLane: { perRow: 12 },
  mobility: 1.5,
  bench: { tieTolerance: 8 },
  search: {
    depth: 2,
    endgameDepth: 3,
    nodeBudget: 20_000,
    tolerance: 6,
    blunderChance: 0.05,
  },
  setup: {
    belowTarget: 12,
    blockerDepth: 10,
    coveragePerColumn: 6,
    defended: 8,
    defendsOther: 6,
    runnerOpenColumn: 8,
    runnerBack: 4,
    counterPick: 10,
    exposed: -15,
    noise: 2,
  },
} as const;

export const NEUTRAL_WEIGHTS: TermWeights = {
  points: 1,
  material: 1,
  progress: 1,
  hanging: 1,
  cohesion: 1,
  containment: 1,
  runnerThreat: 1,
  freeLane: 1,
  mobility: 1,
};

/** Multiplicadores por postura; BALANCED no altera nada. */
export const POSTURE_WEIGHTS: Record<Posture, Partial<TermWeights>> = {
  DEFEND: { containment: 1.8, runnerThreat: 1.8, hanging: 1.2, progress: 0.7 },
  ATTACK: { progress: 1.4, freeLane: 1.5, cohesion: 0.8, containment: 0.8 },
  BALANCED: {},
};

/** Ventaja de material para postura ATTACK, en fracción del valor medio de pieza. */
export const POSTURE_RULES = { attackMaterialLeadRatio: 0.8 } as const;

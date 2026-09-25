import type { PieceRole } from "../introspection/profiles";
import type { Personality } from "../personality";
import type { HardTerm } from "./weights";

/**
 * Perfil de personalidad: solo datos. Los mismos algoritmos (evaluación,
 * postura, búsqueda, setup) leen el perfil — agregar una personalidad es
 * agregar una entrada, nunca una rama de código.
 */
export interface PersonalityProfile {
  id: Personality;
  /** Multiplicadores por término calculado sobre piezas del bot. Default 1. */
  selfMul: Partial<Record<HardTerm, number>>;
  /** Multiplicadores por término calculado sobre piezas del rival. Default 1. */
  oppMul: Partial<Record<HardTerm, number>>;
  /** Ajustes a los umbrales de postura (ver `choosePosture` overrides). */
  posture: {
    defendZoneDelta: number;
    attackZoneDelta: number;
    attackMaterialLeadRatio: number;
  };
  /** Valor de un final sin ganador (bloqueo mutuo / límite) desde el bot. */
  contempt: number;
  /** Ancho del "casi empate" en la raíz para aplicar el estilo de desempate. */
  tieWindow: number;
  /** Criterio de desempate entre jugadas casi iguales. */
  tieBreak: "progress" | "safety" | "none";
  /** Sesgo de despliegue: filas delanteras y composición por rol. */
  setup: { frontBias: number; roleTilt: Partial<Record<PieceRole, number>> };
}

export const PERSONALITY_PROFILES: Record<Personality, PersonalityProfile> = {
  balanced: {
    id: "balanced",
    selfMul: {},
    oppMul: {},
    posture: { defendZoneDelta: 0, attackZoneDelta: 0, attackMaterialLeadRatio: 0.8 },
    contempt: 0,
    tieWindow: 1,
    tieBreak: "none",
    setup: { frontBias: 0, roleTilt: {} },
  },
  offensive: {
    id: "offensive",
    selfMul: {
      progress: 1.35,
      freeLane: 1.5,
      race: 1.3,
      hanging: 0.8,
      cohesion: 0.85,
      containment: 0.75,
      runnerThreat: 0.8,
    },
    oppMul: { progress: 0.9, race: 1 },
    posture: { defendZoneDelta: -1, attackZoneDelta: 1, attackMaterialLeadRatio: 0.5 },
    contempt: -60,
    tieWindow: 8,
    tieBreak: "progress",
    setup: {
      frontBias: 24,
      roleTilt: { runner: 1, attacker: 0.5, blocker: -0.5 },
    },
  },
  defensive: {
    id: "defensive",
    selfMul: {
      progress: 0.85,
      freeLane: 0.9,
      race: 1,
      hanging: 1.3,
      cohesion: 1.3,
      containment: 1.5,
      runnerThreat: 1.5,
    },
    oppMul: { progress: 1.35, race: 1.3 },
    posture: { defendZoneDelta: 1, attackZoneDelta: -1, attackMaterialLeadRatio: 1.2 },
    contempt: 30,
    tieWindow: 8,
    tieBreak: "safety",
    setup: {
      frontBias: -16,
      roleTilt: { blocker: 1, attacker: 0.5, runner: -0.5 },
    },
  },
};

export function getPersonalityProfile(p: Personality): PersonalityProfile {
  return PERSONALITY_PROFILES[p];
}

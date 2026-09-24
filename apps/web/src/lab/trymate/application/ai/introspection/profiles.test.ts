import { describe, expect, it } from "vitest";
import {
  PIECE_MOVEMENT_CONFIG,
  PieceType,
  type PieceMovementConfigMap,
} from "../../../domain/constants/PieceConstants";
import { GAME_RULES } from "../../../domain/constants/GameRules";
import { buildRulesView, CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getRulesInsight } from "./profiles";

const engine = new MovementRuleEngine();
const insight = getRulesInsight(CURRENT_RULES, engine, engine.config);

/**
 * Escenarios de reglas actuales: los tests sí pueden nombrar tipos concretos
 * (los `*.test.ts` están excluidos del guard de agnosticismo). Si cambian las
 * reglas, estos valores esperados se revisan, no el código del bot.
 */
describe("getRulesInsight — reglas actuales", () => {
  it("deriva roles esperados para FORT, STRIKER y PIONEER", () => {
    const fort = insight.profiles.get(PieceType.FORT)!;
    const striker = insight.profiles.get(PieceType.STRIKER)!;
    const pioneer = insight.profiles.get(PieceType.PIONEER)!;

    expect(fort.roles.has("attacker")).toBe(true);
    expect(fort.roles.has("blocker")).toBe(true);
    expect(striker.roles.has("attacker")).toBe(true);
    expect(pioneer.roles.has("runner")).toBe(true);
    expect(pioneer.roles.has("attacker")).toBe(false);
  });

  it("FORT le gana el matchup al STRIKER (ataca sin respuesta)", () => {
    expect(insight.matchup(PieceType.FORT, PieceType.STRIKER)).toBeGreaterThan(0);
  });

  it("geometría derivada del tablero 5×11", () => {
    expect(insight.geometry.runnerZone).toBe(3);
    expect(insight.geometry.endgamePieces).toBe(6);
    expect(insight.geometry.laneWindow).toBe(1);
    expect(insight.geometry.supportRadius).toBe(2);
  });

  it("los valores tienen media ≈ 30 entre tipos", () => {
    const mean =
      CURRENT_RULES.pieceTypes.reduce((sum, t) => sum + insight.profiles.get(t)!.value, 0) /
      CURRENT_RULES.pieceTypes.length;
    expect(mean).toBeGreaterThan(29);
    expect(mean).toBeLessThan(31);
  });
});

describe("getRulesInsight — variantes", () => {
  it("STRIKER con captura diagonal: sube captureCount y baja su matchup vs FORT", () => {
    const config = structuredClone(PIECE_MOVEMENT_CONFIG) as PieceMovementConfigMap;
    config.STRIKER.capture = {
      directions: [
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
      ],
      minDistance: 1,
      maxDistance: 1,
    };
    const altEngine = new MovementRuleEngine(config);
    const alt = getRulesInsight(CURRENT_RULES, altEngine, config);

    expect(alt.profiles.get(PieceType.STRIKER)!.captureCount).toBeGreaterThan(
      insight.profiles.get(PieceType.STRIKER)!.captureCount,
    );
    expect(alt.matchup(PieceType.FORT, PieceType.STRIKER)).toBeLessThan(
      insight.matchup(PieceType.FORT, PieceType.STRIKER),
    );
  });

  it("tablero 7×13: runnerZone 4 y perfiles calculados sin excepciones", () => {
    const wide = buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES);
    const wideInsight = getRulesInsight(wide, engine, engine.config);
    expect(wideInsight.geometry.runnerZone).toBe(4);
    for (const type of wide.pieceTypes) {
      const profile = wideInsight.profiles.get(type);
      expect(profile).toBeDefined();
      expect(profile!.value).toBeGreaterThan(0);
    }
  });

  it("memoiza: mismas reglas + config devuelven el mismo objeto", () => {
    const again = getRulesInsight(CURRENT_RULES, new MovementRuleEngine(), engine.config);
    expect(again).toBe(insight);
  });

  it("overrides de valor reemplazan el derivado", () => {
    const withOverride = getRulesInsight(CURRENT_RULES, engine, engine.config, {
      [PieceType.FORT]: 99,
    });
    expect(withOverride.profiles.get(PieceType.FORT)!.value).toBe(99);
  });
});

import {
  PIECE_MOVEMENT_CONFIG,
  type PieceMovementConfigMap,
} from "../../../domain/constants/PieceConstants";
import { GAME_RULES } from "../../../domain/constants/GameRules";
import { buildRulesView, CURRENT_RULES, type RulesView } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";

/**
 * Una variante de reglas para probar el bot/arena: `rules` + `engine`
 * (config de movimiento posiblemente alterado).
 */
export interface RuleVariant {
  name: string;
  rules: RulesView;
  engine: MovementRuleEngine;
}

const cloneConfig = (): PieceMovementConfigMap =>
  structuredClone(PIECE_MOVEMENT_CONFIG) as PieceMovementConfigMap;

/** Variante "movimientos alterados": FORT también captura de frente; STRIKER carga 3. */
const alteredMoves = (): RuleVariant => {
  const config = cloneConfig();
  config.FORT.capture = {
    directions: [
      { dx: 1, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
    ],
    minDistance: 1,
    maxDistance: 1,
  };
  config.STRIKER.alternativeMovement = {
    directions: [{ dx: 0, dy: 1 }],
    minDistance: 3,
    maxDistance: 3,
    canCapture: false,
    requiresClearPath: true,
  };
  return { name: "altered-moves", rules: CURRENT_RULES, engine: new MovementRuleEngine(config) };
};

/**
 * Variantes de reglas para la arena: cada una ejercita un eje distinto —
 * tamaño, profundidad de despliegue, patrones de movimiento y cantidades.
 */
export const RULE_VARIANTS: RuleVariant[] = [
  { name: "current", rules: CURRENT_RULES, engine: new MovementRuleEngine() },
  {
    name: "wide-7x13",
    rules: buildRulesView({ BOARD_WIDTH: 7, BOARD_HEIGHT: 13 }, GAME_RULES),
    engine: new MovementRuleEngine(),
  },
  {
    name: "shallow-deploy",
    rules: buildRulesView(
      { BOARD_WIDTH: 5, BOARD_HEIGHT: 11 },
      { ...GAME_RULES, PLACEMENT_DEPTH: 2, MAX_PIECES_PER_ROW: 3 },
    ),
    engine: new MovementRuleEngine(),
  },
  alteredMoves(),
  {
    name: "more-pieces",
    rules: buildRulesView(
      { BOARD_WIDTH: 5, BOARD_HEIGHT: 11 },
      { ...GAME_RULES, PIECES_TO_PLACE: 6, PIECES_IN_BENCH: 3, POINTS_TO_WIN: 4 },
    ),
    engine: new MovementRuleEngine(),
  },
];

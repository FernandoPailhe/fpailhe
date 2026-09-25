import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { Player } from "../../../domain/constants/PieceConstants";
import { buildRulesView, rulesFingerprint } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import { getRulesInsight } from "../introspection/profiles";
import { createSeededRng } from "../rng";
import { opponentOf, type SimState } from "../sim/SimState";
import type { BotContext } from "../ComputerPlayer";
import { SearchBoard } from "./SearchBoard";
import { searchHard, type HardSearchResult } from "./search";
import { getPersonalityProfile } from "./personalities";
import { loadHardWeights } from "./weights";
import { TranspositionTable } from "./transposition";
import { planHardArmy } from "./setup";
import { HARD_BOT_CONFIG } from "./config";
import type { HardRequest, SerializedArmyPlan } from "./protocol";

/**
 * TT a nivel de módulo: se reutiliza entre requests con el mismo
 * fingerprint + personalidad (la evaluación depende de ambos). Si cambia
 * cualquiera de los dos, se descarta para no envenenar la búsqueda.
 */
let cachedKey = "";
let cachedTt = new TranspositionTable();

const rebuildBoard = (req: HardRequest): Board => {
  const board = new Board(req.board.width, req.board.height);
  for (const p of req.board.pieces) {
    board.addPiece(new GamePiece(p.id, p.type, new Position(p.x, p.y), p.owner));
  }
  return board;
};

/** Reconstruye un PlayerState mínimo (tipos elegidos + banca) para setup. */
const rebuildPlayerState = (req: HardRequest, player: Player, id: string): PlayerState => {
  const ps = new PlayerState(id);
  for (const t of req.selectedTypes[player]) ps.addSelectedPiece(t);
  req.bench[player].forEach((t, i) =>
    ps.addBenchPiece(new GamePiece(`${id}-bench-${i}`, t, null, player)),
  );
  return ps;
};

/**
 * Lógica pura compartida entre el worker y el fallback inline: reconstruye
 * tablero, reglas y motor desde el request serializado. `kind: "play"`
 * corre `searchHard`; `kind: "setup"` corre `planHardArmy` y devuelve el
 * plan serializado.
 */
export function runHardRequest(req: HardRequest): HardSearchResult | SerializedArmyPlan {
  const rules = buildRulesView(req.boardDims, req.rulesSource, req.pieceTypes);
  const engine = new MovementRuleEngine(req.pieceConfig);
  const board = rebuildBoard(req);
  const fingerprint = rulesFingerprint(rules, engine.config);
  const insight = getRulesInsight(rules, engine, engine.config);
  const profile = getPersonalityProfile(req.personality);

  if (req.kind === "setup") {
    const rng = createSeededRng(req.seed);
    const ctx: BotContext = {
      board,
      bot: req.bot,
      botState: rebuildPlayerState(req, req.bot, "bot"),
      opponentState: rebuildPlayerState(req, opponentOf(req.bot), "opp"),
      engine,
      rules,
      setupMode: req.setupMode,
      rng,
    };
    const plan = planHardArmy(
      ctx,
      insight,
      profile,
      rng,
      req.setupBudget ?? HARD_BOT_CONFIG.setupBudget,
    );
    return {
      boardPieces: plan.boardPieces.map(({ type, position }) => ({
        type,
        x: position.x,
        y: position.y,
      })),
      benchPieces: plan.benchPieces,
    };
  }

  const sim: SimState = {
    rules,
    board,
    current: req.current,
    scores: { ...req.scores },
    bench: {
      [Player.BLANCAS]: [...req.bench[Player.BLANCAS]],
      [Player.NEGRAS]: [...req.bench[Player.NEGRAS]],
    },
    winner: null,
  };
  const root = new SearchBoard(sim, engine);
  const { weights } = loadHardWeights(fingerprint);

  const key = `${fingerprint}|${req.personality}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedTt = new TranspositionTable();
  }
  return searchHard(
    root,
    req.bot,
    insight,
    weights,
    profile,
    req.budget,
    createSeededRng(req.seed),
    cachedTt,
  );
}

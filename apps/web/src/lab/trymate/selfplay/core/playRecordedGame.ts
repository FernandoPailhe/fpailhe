import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { Position } from "../../domain/entities/Position";
import { PlayerState } from "../../domain/entities/PlayerState";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../domain/constants/GameRules";
import { countsOf, feasibleTypes } from "../../domain/rules/composition";
import { generateRandomArmy } from "../../domain/rules/randomArmy";
import { rulesFingerprint } from "../../domain/config/RulesView";
import { getBenchPlacementSquares } from "../../application/rules/turnRules";
import type {
  BotContext,
  BotPlayAction,
  ComputerPlayer,
  DecisionInfo,
} from "../../application/ai/ComputerPlayer";
import { createSeededRng, type Rng } from "../../application/ai/rng";
import { generateMoves, type SimState } from "../../application/ai/sim/SimState";
import type { RuleVariant } from "../../application/ai/testing/ruleVariants";
import {
  GAME_RECORD_SCHEMA,
  snapshotRules,
  type GameRecord,
  type PlayerSpec,
  type PlyRecord,
} from "./record";
import { encodePosition } from "./positionCodec";
import {
  applyRecordedPly,
  benchPieceId,
  boardPieceId,
  type BenchTracker,
  type ReplayFrame,
} from "./replay";
import { computeSideMetrics } from "./metrics";

/** Una acción ilegal aborta la partida: el runner la anota como fallida. */
export class IllegalActionError extends Error {}

export interface GameSpec {
  id: string;
  batchId: string;
  seed: number;
  gitSha: string | null;
  variant: RuleVariant;
  players: Record<Player, { spec: PlayerSpec; create: (rng: Rng) => ComputerPlayer }>;
  setupMode: "ALTERNATING" | "HIDDEN" | "RANDOM";
  opening: { randomPlies: number; epsilon: number };
  maxPlies: number;
  recordPositions: boolean;
}

// Rngs derivados por jugador/apertura: cambiar un bot no altera el azar del otro.
const RNG_PLAYER_W = 0x9e3779b9;
const RNG_PLAYER_N = 0x85ebca6b;
const RNG_OPENING = 0xc2b2ae35;

/** El board filtrado que ve un bot durante el setup HIDDEN (solo sus piezas). */
const boardWithOnlyOwner = (board: Board, owner: Player): Board => {
  const filtered = new Board(board.width, board.height);
  for (const piece of board.getAllPieces()) {
    if (piece.owner === owner) filtered.addPiece(piece.clone());
  }
  return filtered;
};

const chosenTypes = (ps: PlayerState): PieceType[] =>
  ps.getSelectedPieces().concat(ps.getBenchPieces().map((p) => p.type));

const legalSetupTypes = (ps: PlayerState, rules: RuleVariant["rules"]): PieceType[] =>
  feasibleTypes(
    countsOf(chosenTypes(ps), rules),
    rules.piecesToPlace + rules.benchSize - ps.getTotalSelectedCount() - ps.getBenchPieces().length,
    rules,
  );

/** Acción → string corto para `decision.top[].a` (m:<id>:x,y | b:<typeIdx>:x,y | p). */
const actionLabel = (
  a: BotPlayAction,
  typeIdx: (t: PieceType) => number,
  benchTypeOf: (id: string) => PieceType | undefined,
): string => {
  if (a.kind === "move") return `m:${a.pieceId}:${a.to.x},${a.to.y}`;
  if (a.kind === "bench") {
    const t = benchTypeOf(a.benchPieceId);
    return `b:${t !== undefined ? typeIdx(t) : "?"}:${a.to.x},${a.to.y}`;
  }
  return "p";
};

function serializeDecision(
  info: DecisionInfo | null,
  typeIdx: (t: PieceType) => number,
  benchTypeOf: (id: string) => PieceType | undefined,
): PlyRecord["decision"] {
  if (!info) return undefined;
  return {
    eval: info.eval,
    depth: info.depth,
    nodes: info.nodes,
    ms: info.ms,
    posture: info.posture,
    top: info.top?.map((t) => ({ a: actionLabel(t.action, typeIdx, benchTypeOf), s: t.score })),
  };
}

/**
 * Juega UNA partida completa bot-vs-bot y devuelve su `GameRecord`.
 * Determinista: mismo spec → mismo registro (salvo `durationMs`, `ms` y
 * `createdAt`). Toda acción se valida como en la arena; una ilegal lanza
 * `IllegalActionError` (el runner la registra en failures.jsonl).
 */
export async function playRecordedGame(spec: GameSpec): Promise<GameRecord> {
  const { rules, engine, name: variantName } = spec.variant;
  const started = performance.now();
  const abort = new AbortController().signal;

  const rngs: Record<Player, Rng> = {
    [Player.BLANCAS]: createSeededRng(spec.seed ^ RNG_PLAYER_W),
    [Player.NEGRAS]: createSeededRng(spec.seed ^ RNG_PLAYER_N),
  };
  const rngOpen = createSeededRng(spec.seed ^ RNG_OPENING);
  const typeIdx = (t: PieceType): number => rules.pieceTypes.indexOf(t);

  const players = {
    bots: {
      [Player.BLANCAS]: spec.players[Player.BLANCAS].create(rngs[Player.BLANCAS]),
      [Player.NEGRAS]: spec.players[Player.NEGRAS].create(rngs[Player.NEGRAS]),
    },
    states: {
      [Player.BLANCAS]: new PlayerState("p1"),
      [Player.NEGRAS]: new PlayerState("p2"),
    },
  } as const;

  const setupModeCtx =
    spec.setupMode === "RANDOM" ? SetupTurnMode.ALTERNATING : SetupTurnMode[spec.setupMode];
  // El filtro HIDDEN aplica solo durante el setup (como en GameState): en la
  // fase de juego el tablero es visible para ambos.
  const makeCtx = (player: Player, board: Board, phase: "setup" | "play"): BotContext => ({
    board:
      phase === "setup" && spec.setupMode === "HIDDEN" ? boardWithOnlyOwner(board, player) : board,
    bot: player,
    botState: players.states[player],
    opponentState: players.states[player === Player.BLANCAS ? Player.NEGRAS : Player.BLANCAS],
    engine,
    rules,
    setupMode: setupModeCtx,
    rng: rngs[player],
  });

  // ── Setup ──────────────────────────────────────────────────────────
  const board = new Board(rules.width, rules.height);
  const placed: Record<Player, { type: PieceType; x: number; y: number }[]> = {
    [Player.BLANCAS]: [],
    [Player.NEGRAS]: [],
  };

  const placeAt = (p: Player, type: PieceType, at: Position): void => {
    const piece = new GamePiece(boardPieceId(p, placed[p].length), type, at, p);
    board.addPiece(piece);
    players.states[p].addSelectedPiece(type);
    players.states[p].addPlacedPiece(piece);
    placed[p].push({ type, x: at.x, y: at.y });
  };
  const addBench = (p: Player, type: PieceType): void => {
    const ps = players.states[p];
    ps.addBenchPiece(new GamePiece(benchPieceId(p, ps.getBenchPieces().length), type, null, p));
  };

  const fail = (msg: string): never => {
    throw new IllegalActionError(`[${spec.id}] ${msg}`);
  };

  if (spec.setupMode === "RANDOM") {
    for (const p of [Player.BLANCAS, Player.NEGRAS]) {
      const army = generateRandomArmy(rules, p, rngs[p]);
      for (const { type, position } of army.boardPieces) placeAt(p, type, position);
      for (const t of army.benchPieces) addBench(p, t);
    }
  } else {
    const setupStep = async (p: Player, i: number): Promise<void> => {
      const ps = players.states[p];
      const ctx = makeCtx(p, board, "setup");
      try {
        await players.bots[p].prepareSetupAsync?.(ctx, abort);
      } catch {
        // Sin plan → el bot cae a su estrategia sync.
      }
      const pick =
        players.bots[p].chooseSetupPlacement(ctx) ??
        fail(`setup: ${p} no devolvió colocación (pieza ${i + 1})`);
      if (!legalSetupTypes(ps, rules).includes(pick.type)) {
        fail(`setup: ${p} eligió tipo ${pick.type} no factible`);
      }
      const legalSquares = getBenchPlacementSquares(board, p, rules);
      if (!legalSquares.some((sq) => sq.equals(pick.position))) {
        fail(`setup: ${p} colocó en (${pick.position.x},${pick.position.y}) fuera de sus casillas`);
      }
      placeAt(p, pick.type, pick.position);
    };
    const benchStep = async (p: Player, i: number): Promise<void> => {
      const ps = players.states[p];
      const ctx = makeCtx(p, board, "setup");
      try {
        await players.bots[p].prepareSetupAsync?.(ctx, abort);
      } catch {
        // idem
      }
      const type =
        players.bots[p].chooseBenchType(ctx) ?? fail(`bench: ${p} no devolvió tipo (${i + 1})`);
      if (!legalSetupTypes(ps, rules).includes(type)) {
        fail(`bench: ${p} eligió tipo ${type} no factible`);
      }
      addBench(p, type);
    };
    if (spec.setupMode === "ALTERNATING") {
      // Como la arena: B/N intercalados por pieza; bancas por jugador al final.
      for (let i = 0; i < rules.piecesToPlace; i++) {
        for (const p of [Player.BLANCAS, Player.NEGRAS]) await setupStep(p, i);
      }
      for (const p of [Player.BLANCAS, Player.NEGRAS]) {
        for (let i = 0; i < rules.benchSize; i++) await benchStep(p, i);
      }
    } else {
      // HIDDEN (como GameState): cada jugador completa su ejército solo, viendo
      // únicamente sus propias piezas.
      for (const p of [Player.BLANCAS, Player.NEGRAS]) {
        for (let i = 0; i < rules.piecesToPlace; i++) await setupStep(p, i);
        for (let i = 0; i < rules.benchSize; i++) await benchStep(p, i);
      }
    }
  }

  // setup.{board,order}: board ordenado por (y,x); order[k] = índice en board
  // de la pieza colocada en el paso k (reproduce los ids w<k>/n<k>). Se
  // captura AHORA — la banca se consume durante el juego.
  const setupOf = (p: Player) => {
    const sorted = [...placed[p]].sort((a, b) => a.y - b.y || a.x - b.x);
    const order = placed[p].map((piece) =>
      sorted.findIndex((s) => s.x === piece.x && s.y === piece.y),
    );
    return {
      board: sorted,
      bench: players.states[p].getBenchPieces().map((b) => b.type),
      order,
    };
  };
  const setup = {
    [Player.BLANCAS]: setupOf(Player.BLANCAS),
    [Player.NEGRAS]: setupOf(Player.NEGRAS),
  };

  // ── Juego ──────────────────────────────────────────────────────────
  let state: SimState = {
    rules,
    board,
    current: Player.BLANCAS,
    scores: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    bench: {
      [Player.BLANCAS]: players.states[Player.BLANCAS].getBenchPieces().map((b) => b.type),
      [Player.NEGRAS]: players.states[Player.NEGRAS].getBenchPieces().map((b) => b.type),
    },
    winner: null,
  };
  const benchTracker: BenchTracker = {
    list: (p) => players.states[p].getBenchPieces(),
    remove: (p, id) => players.states[p].removeBenchPiece(id),
  };

  const plies: PlyRecord[] = [];
  const randomActions: number[] = [];
  let reason: GameRecord["result"]["reason"] = "maxPlies";

  const randomAction = (): BotPlayAction => {
    const moves = generateMoves(state, engine).map((m) => ({
      kind: "move" as const,
      pieceId: m.pieceId,
      to: m.to,
    }));
    const p = state.current;
    const drops: BotPlayAction[] = [];
    if (state.bench[p].length > 0 && state.board.getPiecesOf(p).length < rules.piecesToPlace) {
      const squares = getBenchPlacementSquares(state.board, p, rules);
      const seen = new Set<string>();
      for (const bp of players.states[p].getBenchPieces()) {
        for (const sq of squares) {
          const key = `${bp.type}:${sq.x},${sq.y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          drops.push({ kind: "bench", benchPieceId: bp.id, to: sq });
        }
      }
    }
    const all: BotPlayAction[] = [...moves, ...drops];
    if (all.length === 0) return { kind: "pass" };
    return all[Math.floor(rngOpen() * all.length)]!;
  };

  while (plies.length < spec.maxPlies) {
    if (state.winner) {
      reason = "points";
      break;
    }
    const p = state.current;
    const ctx = makeCtx(p, state.board, "play");
    const bot = players.bots[p];

    let seq: BotPlayAction[];
    let decision: DecisionInfo | null = null;
    const isRandom = plies.length < spec.opening.randomPlies && rngOpen() < spec.opening.epsilon;
    if (isRandom) {
      seq = [randomAction()];
    } else {
      try {
        seq = bot.choosePlayActionAsync
          ? await bot.choosePlayActionAsync(ctx, abort)
          : [bot.choosePlayAction(ctx)];
      } catch (err) {
        fail(`acción falló: ${(err as Error).message}`);
      }
      decision = bot.getLastDecisionInfo?.() ?? null;
    }
    if (seq!.length === 0) seq = [{ kind: "pass" }];

    for (const [ai, action] of seq!.entries()) {
      if (plies.length >= spec.maxPlies) break;
      const n = plies.length;
      const ply: PlyRecord = {
        n,
        player: p,
        kind: action.kind,
        random: isRandom || undefined,
        pos: spec.recordPositions ? encodePosition(state) : undefined,
        decision:
          ai === 0 && !isRandom
            ? serializeDecision(
                decision,
                typeIdx,
                (id) => players.states[p].getBenchPieces().find((b) => b.id === id)?.type,
              )
            : undefined,
      };
      if (action.kind === "move") {
        const piece = state.board.getPieceById(action.pieceId);
        if (piece?.position) ply.from = [piece.position.x, piece.position.y];
        ply.pieceId = action.pieceId;
        ply.to = [action.to.x, action.to.y];
        const target = state.board.getPieceAt(action.to);
        if (target && target.owner !== p) ply.capture = target.type;
      } else if (action.kind === "bench") {
        const held = players.states[p].getBenchPieces().find((b) => b.id === action.benchPieceId);
        ply.pieceId = action.benchPieceId;
        ply.type = held?.type;
        ply.to = [action.to.x, action.to.y];
      }

      const applied = applyRecordedPly(
        { state, engine, bench: benchTracker } satisfies ReplayFrame,
        ply,
      );
      if (!applied.ok) throw new IllegalActionError(`[${spec.id}] ${applied.error}`);
      state = applied.state;
      ply.capture = applied.capture;
      if (applied.scored) ply.scored = true;
      plies.push(ply);
      if (isRandom) randomActions.push(n);
      if (applied.blockedEnd) {
        reason = "blocked";
        break;
      }
      if (applied.consumesTurn) break; // move/pass consumió el turno
    }
    if (reason === "blocked" || state.winner) {
      if (state.winner) reason = "points";
      break;
    }
  }

  const record: GameRecord = {
    schema: GAME_RECORD_SCHEMA,
    id: spec.id,
    batchId: spec.batchId,
    seed: spec.seed,
    createdAt: new Date().toISOString(),
    gitSha: spec.gitSha,
    rules: {
      fingerprint: rulesFingerprint(rules, engine.config),
      variant: variantName,
      view: snapshotRules(rules),
      pieceConfig: engine.config,
    },
    players: {
      [Player.BLANCAS]: spec.players[Player.BLANCAS].spec,
      [Player.NEGRAS]: spec.players[Player.NEGRAS].spec,
    },
    setupMode: spec.setupMode,
    setup,
    opening: {
      randomPlies: spec.opening.randomPlies,
      epsilon: spec.opening.epsilon,
      randomActions,
    },
    plies,
    result: {
      winner: state.winner,
      scores: { ...state.scores },
      reason,
      plies: plies.length,
      durationMs: performance.now() - started,
    },
    metrics: computeSideMetrics({
      rules: { view: snapshotRules(rules), pieceConfig: engine.config },
      setup,
      plies,
    }),
  };
  return record;
}

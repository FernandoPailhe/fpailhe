import { Board } from "../../domain/entities/Board";
import { GamePiece } from "../../domain/entities/GamePiece";
import { PlayerState } from "../../domain/entities/PlayerState";
import { PieceType, Player } from "../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../domain/constants/GameRules";
import { countsOf, feasibleTypes } from "../../domain/rules/composition";
import { getBenchPlacementSquares } from "../rules/turnRules";
import type { MovementRuleEngine } from "../rules/MovementRuleEngine";
import type { BotContext, BotPlayAction, ComputerPlayer } from "./ComputerPlayer";
import { createSeededRng, type Rng } from "./rng";
import {
  applySimBench,
  applySimMove,
  generateMoves,
  opponentOf,
  passTurn,
  type SimState,
} from "./sim/SimState";
import type { RuleVariant } from "./testing/ruleVariants";

/**
 * Árbitro puro: juega partidas bot-vs-bot sobre `SimState` con las reglas de
 * la variante, sin el store. Cualquier acción ilegal aborta la partida con
 * `illegalAction` describiendo qué pasó — así un cambio de reglas rompe el
 * test donde corresponde, no silenciosamente.
 */

export interface ArenaGameResult {
  winner: Player | null;
  plies: number;
  scores: Record<Player, number>;
  illegalAction?: string;
  /** Métricas de estilo por bando (solo `playArenaGameAsync`). */
  metrics?: Record<Player, SideMetrics>;
}

interface ArenaPlayers {
  bots: Record<Player, ComputerPlayer>;
  states: Record<Player, PlayerState>;
}

const makeCtx = (
  player: Player,
  board: Board,
  players: ArenaPlayers,
  variant: RuleVariant,
  rng: Rng,
): BotContext => ({
  board,
  bot: player,
  botState: players.states[player],
  opponentState: players.states[opponentOf(player)],
  engine: variant.engine,
  rules: variant.rules,
  setupMode: SetupTurnMode.ALTERNATING,
  rng,
});

const chosenTypes = (ps: PlayerState): PieceType[] =>
  ps.getSelectedPieces().concat(ps.getBenchPieces().map((p) => p.type));

const legalSetupTypes = (ps: PlayerState, rules: RuleVariant["rules"]): PieceType[] =>
  feasibleTypes(
    countsOf(chosenTypes(ps), rules),
    rules.piecesToPlace + rules.benchSize - ps.getTotalSelectedCount() - ps.getBenchPieces().length,
    rules,
  );

function hasAnyAction(state: SimState, engine: MovementRuleEngine, ps: PlayerState): boolean {
  if (generateMoves(state, engine).length > 0) return true;
  return (
    ps.getBenchPieces().length > 0 &&
    state.board.getAllPieces().filter((p) => p.owner === state.current).length <
      state.rules.piecesToPlace &&
    getBenchPlacementSquares(state.board, state.current, state.rules).length > 0
  );
}

/**
 * Setup ALTERNATING: cada bando coloca `piecesToPlace` piezas alternando y
 * luego elige `benchSize` tipos de banca. Devuelve el estado inicial o un
 * resultado con `illegalAction`.
 */
function runSetup(
  players: ArenaPlayers,
  variant: RuleVariant,
  rng: Rng,
): { board: Board } | { illegal: string } {
  const { rules } = variant;
  const board = new Board(rules.width, rules.height);
  let pieceCounter = 0;
  const order: Player[] = [Player.BLANCAS, Player.NEGRAS];

  for (let i = 0; i < rules.piecesToPlace; i++) {
    for (const player of order) {
      const ps = players.states[player];
      const ctx = makeCtx(player, board, players, variant, rng);
      const pick = players.bots[player].chooseSetupPlacement(ctx);
      if (!pick) {
        return { illegal: `setup: ${player} no devolvió colocación (pieza ${i + 1})` };
      }
      const legalTypes = legalSetupTypes(ps, rules);
      if (!legalTypes.includes(pick.type)) {
        return {
          illegal: `setup: ${player} eligió tipo ${pick.type} no factible (permitidos: ${legalTypes.join(",")})`,
        };
      }
      const legalSquares = getBenchPlacementSquares(board, player, rules);
      if (!legalSquares.some((p) => p.equals(pick.position))) {
        return {
          illegal: `setup: ${player} colocó en (${pick.position.x},${pick.position.y}) fuera de sus casillas legales`,
        };
      }
      const piece = new GamePiece(`sim-${pieceCounter++}`, pick.type, pick.position, player);
      board.addPiece(piece);
      ps.addSelectedPiece(pick.type);
      ps.addPlacedPiece(piece);
    }
  }

  for (const player of order) {
    const ps = players.states[player];
    for (let i = 0; i < rules.benchSize; i++) {
      const ctx = makeCtx(player, board, players, variant, rng);
      const type = players.bots[player].chooseBenchType(ctx);
      if (!type) {
        return { illegal: `bench: ${player} no devolvió tipo de banca (${i + 1})` };
      }
      const legalTypes = legalSetupTypes(ps, rules);
      if (!legalTypes.includes(type)) {
        return {
          illegal: `bench: ${player} eligió tipo ${type} no factible (permitidos: ${legalTypes.join(",")})`,
        };
      }
      ps.addBenchPiece(new GamePiece(`sim-bench-${pieceCounter++}`, type, null, player));
    }
  }

  return { board };
}

export function playArenaGame(
  white: ComputerPlayer,
  black: ComputerPlayer,
  variant: RuleVariant,
  seed: number,
  maxPlies = 400,
): ArenaGameResult {
  const rng = createSeededRng(seed);
  const players: ArenaPlayers = {
    bots: { [Player.BLANCAS]: white, [Player.NEGRAS]: black },
    states: { [Player.BLANCAS]: new PlayerState("p1"), [Player.NEGRAS]: new PlayerState("p2") },
  };
  const { rules, engine } = variant;
  const scores = { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 } as Record<Player, number>;

  const setup = runSetup(players, variant, rng);
  if ("illegal" in setup) {
    return { winner: null, plies: 0, scores, illegalAction: setup.illegal };
  }

  let state: SimState = {
    rules,
    board: setup.board,
    current: Player.BLANCAS,
    scores,
    bench: {
      [Player.BLANCAS]: players.states[Player.BLANCAS].getBenchPieces().map((p) => p.type),
      [Player.NEGRAS]: players.states[Player.NEGRAS].getBenchPieces().map((p) => p.type),
    },
    winner: null,
  };

  for (let plies = 0; plies < maxPlies; plies++) {
    if (state.winner) return { winner: state.winner, plies, scores: { ...state.scores } };
    const player = state.current;
    const ps = players.states[player];
    const ctx = makeCtx(player, state.board, players, variant, rng);
    const action = players.bots[player].choosePlayAction(ctx);
    const moves = generateMoves(state, engine);

    if (action.kind === "move") {
      const legal = moves.find((m) => m.pieceId === action.pieceId && m.to.equals(action.to));
      if (!legal) {
        return {
          winner: null,
          plies,
          scores: { ...state.scores },
          illegalAction: `move ilegal: ${player} ${action.pieceId} → (${action.to.x},${action.to.y})`,
        };
      }
      state = applySimMove(state, legal);
      continue;
    }

    if (action.kind === "bench") {
      const benchPiece = ps.getBenchPieces().find((p) => p.id === action.benchPieceId);
      if (!benchPiece) {
        return {
          winner: null,
          plies,
          scores: { ...state.scores },
          illegalAction: `bench ilegal: ${player} no tiene la pieza ${action.benchPieceId}`,
        };
      }
      try {
        state = applySimBench(state, benchPiece.type, action.to, benchPiece.id);
      } catch (err) {
        return {
          winner: null,
          plies,
          scores: { ...state.scores },
          illegalAction: `bench ilegal: ${(err as Error).message}`,
        };
      }
      ps.removeBenchPiece(benchPiece.id);
      continue; // acción libre: no cambia el turno
    }

    // pass: solo legal si no hay ninguna acción.
    if (hasAnyAction(state, engine, ps)) {
      return {
        winner: null,
        plies,
        scores: { ...state.scores },
        illegalAction: `pass ilegal: ${player} aún tiene acciones legales`,
      };
    }
    // resolveStalledTurn: el turno pasa al rival si puede actuar; si no, fin.
    const other = opponentOf(player);
    const otherState: SimState = passTurn(state);
    if (hasAnyAction(otherState, engine, players.states[other])) {
      state = otherState;
      continue;
    }
    return { winner: null, plies, scores: { ...state.scores } };
  }

  return { winner: state.winner, plies: maxPlies, scores: { ...state.scores } };
}

export interface ArenaSummary {
  aWins: number;
  bWins: number;
  draws: number;
  illegal: number;
  firstIllegalAction?: string;
}

/** Métricas de estilo de un bando dentro de una partida. */
export interface SideMetrics {
  /** Suma del progreso de la pieza más adelantada en cada turno propio. */
  frontProgressSum: number;
  frontTurns: number;
  /** Ply en que el bando anotó por primera vez (null si nunca). */
  pliesToFirstScore: number | null;
  capturesMade: number;
  piecesLost: number;
  /** Máximo progreso alcanzado por el rival durante la partida. */
  opponentMaxProgress: number;
  /** La partida terminó sin ganador (bloqueo mutuo o límite de plies). */
  endedByBlock: boolean;
}

const freshSideMetrics = (): SideMetrics => ({
  frontProgressSum: 0,
  frontTurns: 0,
  pliesToFirstScore: null,
  capturesMade: 0,
  piecesLost: 0,
  opponentMaxProgress: 0,
  endedByBlock: false,
});

/** Progreso de la pieza más adelantada: filas ganadas desde la fila propia. */
const frontProgress = (board: Board, player: Player, rules: RuleVariant["rules"]): number => {
  const home = rules.homeRow(player);
  let best = 0;
  for (const p of board.getPiecesOf(player)) {
    if (p.position) best = Math.max(best, Math.abs(p.position.y - home));
  }
  return best;
};

const illegal = (
  msg: string,
  scores: Record<Player, number>,
  plies: number,
  metrics: Record<Player, SideMetrics>,
  maxFront: Record<Player, number>,
): ArenaGameResult => {
  for (const p of [Player.BLANCAS, Player.NEGRAS]) {
    metrics[p].opponentMaxProgress = maxFront[opponentOf(p)];
  }
  return { winner: null, plies, scores: { ...scores }, illegalAction: msg, metrics };
};

/**
 * Variante async de `playArenaGame`: usa `choosePlayActionAsync` (secuencia
 * [banca…, jugada|pase]) cuando el bot lo expone — así Hard corre su búsqueda
 * real (en tests: forceInline + presupuesto de nodos). Además acumula
 * `metrics` de estilo por bando.
 */
export async function playArenaGameAsync(
  white: ComputerPlayer,
  black: ComputerPlayer,
  variant: RuleVariant,
  seed: number,
  maxPlies = 400,
): Promise<ArenaGameResult> {
  const rng = createSeededRng(seed);
  const players: ArenaPlayers = {
    bots: { [Player.BLANCAS]: white, [Player.NEGRAS]: black },
    states: { [Player.BLANCAS]: new PlayerState("p1"), [Player.NEGRAS]: new PlayerState("p2") },
  };
  const { rules, engine } = variant;
  const scores = { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 } as Record<Player, number>;
  const metrics = {
    [Player.BLANCAS]: freshSideMetrics(),
    [Player.NEGRAS]: freshSideMetrics(),
  } as Record<Player, SideMetrics>;
  const maxFront = { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 } as Record<Player, number>;
  const abort = new AbortController().signal;

  // Setup: igual que runSetup pero deja que el bot planifique (async).
  const board = new Board(rules.width, rules.height);
  let pieceCounter = 0;
  const order: Player[] = [Player.BLANCAS, Player.NEGRAS];
  for (let i = 0; i < rules.piecesToPlace; i++) {
    for (const player of order) {
      const ps = players.states[player];
      const ctx = makeCtx(player, board, players, variant, rng);
      try {
        await players.bots[player].prepareSetupAsync?.(ctx, abort);
      } catch {
        // Sin plan → el bot cae a su estrategia sync.
      }
      const pick = players.bots[player].chooseSetupPlacement(ctx);
      if (!pick) {
        return illegal(
          `setup: ${player} no devolvió colocación (pieza ${i + 1})`,
          scores,
          0,
          metrics,
          maxFront,
        );
      }
      const legalTypes = legalSetupTypes(ps, rules);
      if (!legalTypes.includes(pick.type)) {
        return illegal(
          `setup: ${player} eligió tipo ${pick.type} no factible`,
          scores,
          0,
          metrics,
          maxFront,
        );
      }
      const legalSquares = getBenchPlacementSquares(board, player, rules);
      if (!legalSquares.some((p) => p.equals(pick.position))) {
        return illegal(
          `setup: ${player} colocó fuera de sus casillas legales`,
          scores,
          0,
          metrics,
          maxFront,
        );
      }
      const piece = new GamePiece(`sim-${pieceCounter++}`, pick.type, pick.position, player);
      board.addPiece(piece);
      ps.addSelectedPiece(pick.type);
      ps.addPlacedPiece(piece);
    }
  }
  for (const player of order) {
    const ps = players.states[player];
    for (let i = 0; i < rules.benchSize; i++) {
      const ctx = makeCtx(player, board, players, variant, rng);
      try {
        await players.bots[player].prepareSetupAsync?.(ctx, abort);
      } catch {
        // idem
      }
      const type = players.bots[player].chooseBenchType(ctx);
      if (!type) {
        return illegal(
          `bench: ${player} no devolvió tipo de banca (${i + 1})`,
          scores,
          0,
          metrics,
          maxFront,
        );
      }
      const legalTypes = legalSetupTypes(ps, rules);
      if (!legalTypes.includes(type)) {
        return illegal(
          `bench: ${player} eligió tipo ${type} no factible`,
          scores,
          0,
          metrics,
          maxFront,
        );
      }
      ps.addBenchPiece(new GamePiece(`sim-bench-${pieceCounter++}`, type, null, player));
    }
  }

  let state: SimState = {
    rules,
    board,
    current: Player.BLANCAS,
    scores,
    bench: {
      [Player.BLANCAS]: players.states[Player.BLANCAS].getBenchPieces().map((p) => p.type),
      [Player.NEGRAS]: players.states[Player.NEGRAS].getBenchPieces().map((p) => p.type),
    },
    winner: null,
  };

  const finish = (plies: number): ArenaGameResult => {
    for (const p of [Player.BLANCAS, Player.NEGRAS]) {
      metrics[p].opponentMaxProgress = maxFront[opponentOf(p)];
      metrics[p].endedByBlock = !state.winner;
    }
    return { winner: state.winner, plies, scores: { ...state.scores }, metrics };
  };

  for (let plies = 0; plies < maxPlies; plies++) {
    if (state.winner) return finish(plies);
    const player = state.current;
    const ps = players.states[player];
    const m = metrics[player];
    const front = frontProgress(state.board, player, rules);
    m.frontProgressSum += front;
    m.frontTurns += 1;
    maxFront[player] = Math.max(maxFront[player], front);

    const ctx = makeCtx(player, state.board, players, variant, rng);
    const bot = players.bots[player];
    let actions: BotPlayAction[];
    try {
      actions = bot.choosePlayActionAsync
        ? await bot.choosePlayActionAsync(ctx, abort)
        : [bot.choosePlayAction(ctx)];
    } catch (err) {
      return illegal(
        `acción falló: ${(err as Error).message}`,
        state.scores,
        plies,
        metrics,
        maxFront,
      );
    }
    if (actions.length === 0) actions = [{ kind: "pass" }];

    for (const action of actions) {
      const moves = generateMoves(state, engine);
      if (action.kind === "move") {
        const legal = moves.find((m) => m.pieceId === action.pieceId && m.to.equals(action.to));
        if (!legal) {
          return illegal(
            `move ilegal: ${player} ${action.pieceId} → (${action.to.x},${action.to.y})`,
            state.scores,
            plies,
            metrics,
            maxFront,
          );
        }
        const target = state.board.getPieceAt(action.to);
        if (target && target.owner !== player) {
          m.capturesMade += 1;
          metrics[target.owner].piecesLost += 1;
        }
        state = applySimMove(state, legal);
        if (state.scores[player] > 0 && m.pliesToFirstScore === null) {
          m.pliesToFirstScore = plies;
        }
        break; // la jugada consume el turno: no hay más acciones
      }
      if (action.kind === "bench") {
        const benchPiece = ps.getBenchPieces().find((p) => p.id === action.benchPieceId);
        if (!benchPiece) {
          return illegal(
            `bench ilegal: ${player} no tiene la pieza ${action.benchPieceId}`,
            state.scores,
            plies,
            metrics,
            maxFront,
          );
        }
        try {
          state = applySimBench(state, benchPiece.type, action.to, benchPiece.id);
        } catch (err) {
          return illegal(
            `bench ilegal: ${(err as Error).message}`,
            state.scores,
            plies,
            metrics,
            maxFront,
          );
        }
        ps.removeBenchPiece(benchPiece.id);
        continue; // acción libre: no cambia el turno
      }
      // pass: solo legal si no hay ninguna acción.
      if (hasAnyAction(state, engine, ps)) {
        return illegal(
          `pass ilegal: ${player} aún tiene acciones legales`,
          state.scores,
          plies,
          metrics,
          maxFront,
        );
      }
      const other = opponentOf(player);
      const otherState: SimState = passTurn(state);
      if (hasAnyAction(otherState, engine, players.states[other])) {
        state = otherState;
      } else {
        return finish(plies);
      }
      break; // el pase consume el turno
    }
    // Si la secuencia no consumió el turno (solo bajadas), el mismo jugador
    // decide de nuevo en el siguiente ply.
  }

  return finish(maxPlies);
}

export interface ArenaAsyncSummary extends ArenaSummary {
  /** Métricas por partida, mapeadas a los bots `a`/`b` (colores alternados). */
  perGame: { a: SideMetrics; b: SideMetrics }[];
}

/** `a` y `b` alternan colores; cada partida usa `seed + i`. Versión async. */
export async function runArenaAsync(
  a: (rng: Rng) => ComputerPlayer,
  b: (rng: Rng) => ComputerPlayer,
  variant: RuleVariant,
  games: number,
  seed: number,
): Promise<ArenaAsyncSummary> {
  const summary: ArenaAsyncSummary = { aWins: 0, bWins: 0, draws: 0, illegal: 0, perGame: [] };
  for (let i = 0; i < games; i++) {
    const rngA = createSeededRng(seed + i * 2);
    const rngB = createSeededRng(seed + i * 2 + 1);
    const botA = a(rngA);
    const botB = b(rngB);
    const aPlaysWhite = i % 2 === 0;
    const result = await playArenaGameAsync(
      aPlaysWhite ? botA : botB,
      aPlaysWhite ? botB : botA,
      variant,
      seed + i,
    );
    if (result.illegalAction) {
      summary.illegal++;
      summary.firstIllegalAction ??= `[${variant.name}] ${result.illegalAction}`;
    } else if (!result.winner) {
      summary.draws++;
    } else if ((result.winner === Player.BLANCAS) === aPlaysWhite) {
      summary.aWins++;
    } else {
      summary.bWins++;
    }
    const gm = result.metrics;
    summary.perGame.push({
      a: gm?.[aPlaysWhite ? Player.BLANCAS : Player.NEGRAS] ?? freshSideMetrics(),
      b: gm?.[aPlaysWhite ? Player.NEGRAS : Player.BLANCAS] ?? freshSideMetrics(),
    });
    // Ceder el loop para que el runner (vitest) no se congele en series largas.
    await new Promise((r) => setTimeout(r, 0));
    botA.dispose?.();
    botB.dispose?.();
  }
  return summary;
}

/** `a` y `b` alternan colores; cada partida usa `seed + i`. */
export function runArena(
  a: (rng: Rng) => ComputerPlayer,
  b: (rng: Rng) => ComputerPlayer,
  variant: RuleVariant,
  games: number,
  seed: number,
): ArenaSummary {
  const summary: ArenaSummary = { aWins: 0, bWins: 0, draws: 0, illegal: 0 };
  for (let i = 0; i < games; i++) {
    const rngA = createSeededRng(seed + i * 2);
    const rngB = createSeededRng(seed + i * 2 + 1);
    const botA = a(rngA);
    const botB = b(rngB);
    const aPlaysWhite = i % 2 === 0;
    const result = playArenaGame(
      aPlaysWhite ? botA : botB,
      aPlaysWhite ? botB : botA,
      variant,
      seed + i,
    );
    if (result.illegalAction) {
      summary.illegal++;
      summary.firstIllegalAction ??= `[${variant.name}] ${result.illegalAction}`;
      continue;
    }
    if (!result.winner) {
      summary.draws++;
    } else if ((result.winner === Player.BLANCAS) === aPlaysWhite) {
      summary.aWins++;
    } else {
      summary.bWins++;
    }
  }
  return summary;
}

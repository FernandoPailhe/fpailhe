import { Player } from "../../domain/constants/PieceConstants";
import { opponentOf } from "../../application/ai/sim/SimState";
import type { GameRecord, SideMetrics } from "./record";
import { applyRecordedPly, initialSimFromRecord, type ReplaySource } from "./replay";

/**
 * Métricas por bando, recalculadas re-jugando los plies del registro sobre
 * `SimState` — así el grabador y cualquier consumidor obtienen los mismos
 * números de una sola fuente de verdad.
 */
export function computeSideMetrics(
  source: ReplaySource & { plies: GameRecord["plies"] },
): Record<Player, SideMetrics> {
  const frame = initialSimFromRecord(source);
  let state = frame.state;

  const frontSum: Record<Player, number> = { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 };
  const frontTurns: Record<Player, number> = { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 };
  const maxFront: Record<Player, number> = { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 };
  const m = {
    capturesMade: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    piecesLost: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    benchDrops: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    randomActions: { [Player.BLANCAS]: 0, [Player.NEGRAS]: 0 },
    pliesToFirstScore: {
      [Player.BLANCAS]: null as number | null,
      [Player.NEGRAS]: null as number | null,
    },
  };

  const frontProgress = (p: Player): number => {
    const home = state.rules.homeRow(p);
    let front = 0;
    for (const piece of state.board.getPiecesOf(p)) {
      if (!piece.position) continue;
      front = Math.max(front, Math.abs(piece.position.y - home));
    }
    return front;
  };

  // El frente se mide al inicio de cada turno (antes de la primera acción):
  // un ply continúa el turno anterior solo si el previo fue `bench` (acción
  // libre); `move` y `pass` consumen el turno.
  for (const [i, ply] of source.plies.entries()) {
    const prev = i > 0 ? source.plies[i - 1]! : null;
    if (prev === null || prev.kind !== "bench") {
      const front = frontProgress(ply.player);
      frontSum[ply.player] += front;
      frontTurns[ply.player] += 1;
      maxFront[ply.player] = Math.max(maxFront[ply.player], front);
    }

    const applied = applyRecordedPly({ ...frame, state }, ply);
    if (!applied.ok) break; // el registro ya pasó validación; ante corrupción cortamos
    state = applied.state;

    if (applied.capture) {
      m.capturesMade[ply.player] += 1;
      m.piecesLost[opponentOf(ply.player)] += 1;
    }
    if (applied.scored && m.pliesToFirstScore[ply.player] === null) {
      m.pliesToFirstScore[ply.player] = ply.n;
    }
    if (ply.kind === "bench") m.benchDrops[ply.player] += 1;
    if (ply.random) m.randomActions[ply.player] += 1;
  }

  const side = (p: Player): SideMetrics => ({
    avgFrontProgress: frontTurns[p] > 0 ? frontSum[p] / frontTurns[p] : 0,
    maxProgress: maxFront[p],
    pliesToFirstScore: m.pliesToFirstScore[p],
    capturesMade: m.capturesMade[p],
    piecesLost: m.piecesLost[p],
    opponentMaxProgress: maxFront[opponentOf(p)],
    benchDrops: m.benchDrops[p],
    randomActions: m.randomActions[p],
  });
  return { [Player.BLANCAS]: side(Player.BLANCAS), [Player.NEGRAS]: side(Player.NEGRAS) };
}

import { Position } from "../../../domain/entities/Position";
import type { BotContext, BotPlayAction } from "../ComputerPlayer";
import type { HardAction } from "./SearchBoard";

const toBench = (
  action: { to: { x: number; y: number } },
  benchPieceId: string,
): BotPlayAction => ({
  kind: "bench",
  benchPieceId,
  to: new Position(action.to.x, action.to.y),
});

const toMove = (pieceId: string, to: { x: number; y: number }): BotPlayAction => ({
  kind: "move",
  pieceId,
  to: new Position(to.x, to.y),
});

/**
 * Convierte una HardAction en BotPlayAction resolviendo `benchPieceId` real
 * contra la banca del contexto y reconstruyendo `Position` para el dominio.
 */
export function toBotPlayAction(action: HardAction | null, ctx: BotContext): BotPlayAction {
  if (action?.kind === "bench") {
    const piece = ctx.botState.getBenchPieces().find((p) => p.type === action.type);
    if (piece) return toBench(action, piece.id);
    return { kind: "pass" }; // inalcanzable si la acción vino de la banca real
  }
  if (action?.kind === "move") return toMove(action.pieceId, action.to);
  return { kind: "pass" };
}

/**
 * Secuencia completa del turno ([bench…, move|pass]). Las bajadas de banca
 * se resuelven contra `ctx.botState` sin aplicarlas todavía: consume ids ya
 * usados para que dos drops del mismo tipo no apunten a la misma pieza. Una
 * jugada que sale de la casilla de un drop recién mapeado usa el id de esa
 * pieza de banca real (en la búsqueda tiene un id provisional `sb-bench-*`).
 */
export function toBotPlayActions(actions: HardAction[], ctx: BotContext): BotPlayAction[] {
  const used = new Set<string>();
  const droppedAt = new Map<string, string>(); // "x,y" → benchPieceId real
  const out: BotPlayAction[] = [];
  for (const action of actions) {
    if (action.kind === "bench") {
      const piece = ctx.botState
        .getBenchPieces()
        .find((p) => p.type === action.type && !used.has(p.id));
      if (!piece) continue; // no debería ocurrir: la acción vino de la banca real
      used.add(piece.id);
      droppedAt.set(`${action.to.x},${action.to.y}`, piece.id);
      out.push(toBench(action, piece.id));
    } else if (action.kind === "move") {
      let pieceId = action.pieceId;
      if (!ctx.board.getPieceById(pieceId)?.position) {
        pieceId = action.from
          ? (droppedAt.get(`${action.from.x},${action.from.y}`) ??
            ctx.board.getPieceAt(new Position(action.from.x, action.from.y))?.id ??
            pieceId)
          : pieceId;
      }
      out.push(toMove(pieceId, action.to));
    } else {
      out.push({ kind: "pass" });
    }
  }
  return out;
}

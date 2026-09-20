import { PieceType, Player } from "../domain/constants/PieceConstants";
import type { MoveDiagramSpec, RulesContent } from "../lib/rulesContent";
import { PieceToken } from "./PieceToken";

const GRID = 5;

export interface MoveDiagramProps {
  spec: MoveDiagramSpec;
  pieceType: PieceType;
  legend: RulesContent["diagramLegend"];
}

/**
 * Mini-tablero 5×5 con un ejemplo de movimiento: la pieza desde la
 * perspectiva de Blancas (arriba = hacia adelante), dots dorados para
 * movimiento, anillo rojo para captura y casillas atenuadas para zonas
 * bloqueadas por un Fort.
 */
export function MoveDiagram({ spec, pieceType, legend }: MoveDiagramProps) {
  const cells = new Map(spec.cells.map((c) => [`${c.x},${c.y}`, c.kind] as const));
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        className="grid grid-cols-5 gap-0.5 rounded-lg border border-line bg-surface p-1.5"
        role="img"
        aria-label={`${pieceType} movement example`}
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID;
          const y = Math.floor(i / GRID);
          const kind = cells.get(`${x},${y}`);
          const isPiece = spec.piece.x === x && spec.piece.y === y;
          const parity = (x + y) % 2 === 1;
          return (
            <div
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-sm border border-line ${
                parity ? "bg-pitch" : "bg-pitch-alt"
              }`}
            >
              {isPiece ? (
                <PieceToken type={pieceType} owner={Player.BLANCAS} />
              ) : kind === "move" ? (
                <span className="h-2 w-2 rounded-full bg-gold ring-2 ring-pitch" />
              ) : kind === "capture" ? (
                <span className="h-2.5 w-2.5 rounded-full border-2 border-crimson-bright" />
              ) : kind === "block" ? (
                <span aria-hidden="true" className="font-ui text-xs text-ink-dim">
                  ×
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <figcaption className="flex items-center gap-3 font-ui text-[10px] text-ink-dim">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gold ring-1 ring-pitch" /> {legend.move}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-crimson-bright" />{" "}
          {legend.capture}
        </span>
        <span className="flex items-center gap-1">
          <span className="flex h-3 w-3 items-center justify-center rounded-sm border border-line bg-pitch-alt font-ui text-[9px] leading-none text-ink-dim">
            ×
          </span>
          {legend.block}
        </span>
      </figcaption>
    </figure>
  );
}

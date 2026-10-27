import type { StageView } from "../application/types";
import { uiCopy } from "../lib/copy";

/** "ETAPA 2/3 · TURNO 14 · PUNTOS 120" + nombre de la etapa. */
export function StageBanner({
  stage,
  turn,
  score,
}: {
  stage?: StageView;
  turn: number;
  score: number;
}) {
  return (
    <div className="uv-stage">
      <p className="uv-stage-line">
        {stage !== undefined && (
          <>
            {uiCopy.hud.stage} {stage.order}/{stage.total}
            {" · "}
          </>
        )}
        {uiCopy.hud.turn} {turn} · {uiCopy.hud.points} {score}
      </p>
      {stage !== undefined && <p className="uv-stage-name">{stage.name}</p>}
    </div>
  );
}

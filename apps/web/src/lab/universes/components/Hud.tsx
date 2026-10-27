import { useEffect, useRef } from "react";

import type { IconView, ParameterView, PowerView, StageView } from "../application/types";
import type { ID } from "../domain/models";

import { ParametersPanel } from "./ParametersPanel";
import { PowersRow } from "./PowersRow";
import { StageBanner } from "./StageBanner";

/**
 * HUD de partida: etapa/turno/puntos → parámetros → poderes, separados
 * por hairlines. Recibe las partes de `NarrativeGame`, no el hook.
 * Registra qué parámetros ya se mostraron con nombre (solo la primera vez).
 */
export function Hud({
  stage,
  turn,
  score,
  parameters,
  powers,
  icons,
}: {
  stage?: StageView;
  turn: number;
  score: number;
  parameters: ParameterView[];
  powers: PowerView[];
  icons: Record<ID, IconView>;
}) {
  const seenParamIds = useRef(new Set<ID>());
  useEffect(() => {
    for (const p of parameters) seenParamIds.current.add(p.id);
  }, [parameters]);

  return (
    <div className="uv-hud">
      <StageBanner stage={stage} turn={turn} score={score} />
      <ParametersPanel parameters={parameters} icons={icons} seenParamIds={seenParamIds.current} />
      <PowersRow powers={powers} icons={icons} />
    </div>
  );
}

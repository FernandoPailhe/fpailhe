import type { OptionView } from "../application/types";
import type { ID } from "../domain/models";

import { OptionButton } from "./OptionButton";

/** Lista de opciones de la carta (las ocultas ya no llegan acá). */
export function OptionList({
  options,
  onChoose,
  busy = false,
}: {
  options: OptionView[];
  onChoose: (id: ID) => void;
  busy?: boolean;
}) {
  return (
    <ul className="uv-options" aria-busy={busy}>
      {options.map((o, i) => (
        <li key={o.id}>
          <OptionButton option={o} index={i} onChoose={onChoose} />
        </li>
      ))}
    </ul>
  );
}

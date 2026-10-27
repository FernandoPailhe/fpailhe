import type { OptionView } from "../application/types";
import type { ID } from "../domain/models";
import { uiCopy } from "../lib/copy";

/**
 * Una opción de decisión: numeral `1–3`, etiqueta y estados.
 * `locked` usa `aria-disabled` (sigue siendo enfocable: el lector lee la
 * razón) y muestra el glifo ⊘ + `lockedReason`; el clic no hace nada.
 * `kind: "balance"` lleva la etiqueta de texto "EQUILIBRIO".
 */
export function OptionButton({
  option,
  index,
  onChoose,
}: {
  option: OptionView;
  index: number;
  onChoose: (id: ID) => void;
}) {
  const locked = option.state !== "available";
  return (
    <button
      type="button"
      className={`uv-option${locked ? " uv-option--locked" : ""}`}
      aria-disabled={locked}
      onClick={() => {
        if (!locked) onChoose(option.id);
      }}
    >
      <span className="uv-option-num" aria-hidden="true">
        {index + 1}
      </span>
      <span className="uv-option-body">
        <span className="uv-option-label">
          {locked && (
            <span className="uv-option-glyph" aria-hidden="true">
              ⊘{" "}
            </span>
          )}
          {option.label}
          {option.kind === "balance" && (
            <span className="uv-option-kind">{uiCopy.card.balance}</span>
          )}
        </span>
        {locked && option.lockedReason !== undefined && (
          <span className="uv-option-reason">{option.lockedReason}</span>
        )}
      </span>
    </button>
  );
}

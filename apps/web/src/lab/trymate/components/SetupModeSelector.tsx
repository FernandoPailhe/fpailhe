import { Button } from "@ferpa/ui";
import { SetupTurnMode } from "../domain/constants/GameRules";

const OPTIONS: { value: SetupTurnMode; label: string; hint: string }[] = [
  {
    value: SetupTurnMode.ALTERNATING,
    label: "Alternating turns",
    hint: "Players take turns placing one piece at a time.",
  },
  {
    value: SetupTurnMode.HIDDEN,
    label: "Hidden setup",
    hint: "Each player sets up their full army in secret; boards are revealed when both finish.",
  },
];

export interface SetupModeSelectorProps {
  value: SetupTurnMode;
  onChange: (mode: SetupTurnMode) => void;
  disabled?: boolean;
}

/**
 * Selector del modo de turnos del setup (alternado vs. oculto). Muestra
 * ambas opciones como tabs accesibles vía radio group.
 */
export function SetupModeSelector({ value, onChange, disabled }: SetupModeSelectorProps) {
  const selected = OPTIONS.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Setup mode" className="flex gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="tab"
            active={value === option.value}
            disabled={disabled}
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {selected && <p className="font-ui text-xs text-ink-dim">{selected.hint}</p>}
    </div>
  );
}

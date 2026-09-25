import { Button } from "@ferpa/ui";
import type { Personality } from "../application/ai/personality";

const OPTIONS: { value: Personality; label: string; hint: string }[] = [
  {
    value: "balanced",
    label: "Balanced",
    hint: "Adapts: attacks when ahead, defends when threatened.",
  },
  {
    value: "offensive",
    label: "Offensive",
    hint: "Pushes runners early and takes risks to score first.",
  },
  {
    value: "defensive",
    label: "Defensive",
    hint: "Builds a wall, blocks your runners and waits for mistakes.",
  },
];

export interface PersonalitySelectorProps {
  value: Personality;
  onChange: (personality: Personality) => void;
  disabled?: boolean;
}

/**
 * Selector de personalidad del bot Hard (estilo de juego, no nivel). Mismo
 * patrón de radio group que `SetupModeSelector`; la página lo muestra solo
 * cuando la dificultad elegida es Hard.
 */
export function PersonalitySelector({ value, onChange, disabled }: PersonalitySelectorProps) {
  const selected = OPTIONS.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Computer personality" className="flex flex-wrap gap-2">
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

import { Button } from "@ferpa/ui";
import type { BotDifficulty } from "../application/ai/ComputerPlayer";

const OPTIONS: { value: BotDifficulty; label: string; hint: string }[] = [
  {
    value: "easy",
    label: "Easy",
    hint: "Quick, imperfect decisions. Good to learn the rules.",
  },
  {
    value: "medium",
    label: "Medium",
    hint: "Looks one reply ahead, blocks runners and advances in formation.",
  },
];

export interface DifficultySelectorProps {
  value: BotDifficulty;
  onChange: (difficulty: BotDifficulty) => void;
  disabled?: boolean;
}

/**
 * Selector de dificultad del rival computadora (Easy vs. Medium). Muestra
 * ambas opciones como tabs accesibles vía radio group.
 */
export function DifficultySelector({ value, onChange, disabled }: DifficultySelectorProps) {
  const selected = OPTIONS.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Computer difficulty" className="flex gap-2">
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

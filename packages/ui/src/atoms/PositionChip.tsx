export interface PositionChipProps {
  position: number;
  /** 1, 2 o 3 si corresponde acento de podio; `undefined` para el resto. */
  podium?: 1 | 2 | 3;
}

const PODIUM_CLASSES: Record<1 | 2 | 3, string> = {
  1: "border-gold bg-gold-soft text-gold-bright",
  2: "border-silver bg-silver-soft text-silver",
  3: "border-bronze bg-bronze-soft text-bronze-bright",
};

export function PositionChip({ position, podium }: PositionChipProps) {
  const podiumClass = podium ? PODIUM_CLASSES[podium] : "border-line bg-surface-raised text-ink-dim";

  return (
    <span
      className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-pill border font-mono text-sm font-bold ${podiumClass}`}
    >
      {position}
    </span>
  );
}

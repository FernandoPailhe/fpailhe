import type { IconView, PowerView } from "../application/types";
import type { ID } from "../domain/models";
import { uiCopy } from "../lib/copy";
import { resolveIcon, type ResolvedIcon } from "../theme/iconResolver";

import { UniverseIcon } from "./UniverseIcon";

const KIND_TAGS: Record<PowerView["kind"], string[]> = {
  shield: ["shield", "power"],
  option_unlock: ["key", "power"],
  modifier: ["power"],
  custom: ["power"],
};

/** Chip de un poder: ícono + nombre + cargas (`×2`, o `2/3` si hay máximo). */
export function PowerChip({ power, icon }: { power: PowerView; icon: ResolvedIcon }) {
  const charges =
    power.maxCharges !== undefined
      ? `${power.charges}/${power.maxCharges}`
      : `×${power.charges}`;
  return (
    <span
      className="uv-power"
      aria-label={uiCopy.hud.powerLabel(uiCopy.hud.powerKind(power.kind), power.name, power.charges)}
    >
      <UniverseIcon resolved={icon} decorative size={16} />
      <span className="uv-power-name">{power.name}</span>
      <span className="uv-power-charges">{charges}</span>
    </span>
  );
}

/** Fila de poderes activos; vacía no se renderiza. */
export function PowersRow({
  powers,
  icons,
}: {
  powers: PowerView[];
  icons: Record<ID, IconView>;
}) {
  if (powers.length === 0) return null;
  return (
    <div className="uv-powers" aria-label={uiCopy.hud.powersLabel}>
      {powers.map((p) => (
        <PowerChip
          key={p.id}
          power={p}
          icon={resolveIcon({
            iconId: p.iconId,
            fallbackTags: KIND_TAGS[p.kind],
            name: p.name,
            icons,
          })}
        />
      ))}
    </div>
  );
}

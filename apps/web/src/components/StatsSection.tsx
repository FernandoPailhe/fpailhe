import type { Stat as StatData } from "@ferpa/data-model";
import { Stat } from "@ferpa/ui";

export interface StatsSectionProps {
  stats: StatData[];
}

/** Franja full-width de stats, separadas por hairlines de 1px. */
export function StatsSection({ stats }: StatsSectionProps) {
  return (
    <section className="border-y border-line bg-surface-raised">
      <div className="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px bg-line">
          {stats.map((stat) => (
            <Stat key={stat.label} value={stat.value} label={stat.label} sublabel={stat.sublabel} />
          ))}
        </div>
      </div>
    </section>
  );
}

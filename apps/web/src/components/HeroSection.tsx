import type { CTA } from "@ferpa/data-model";
import { Kicker, TextLink } from "@ferpa/ui";

export interface HeroSectionProps {
  kicker: string;
  headlineLead: string;
  headlineEmphasis: string;
  subhead: string;
  ctas: CTA[];
}

export function HeroSection({
  kicker,
  headlineLead,
  headlineEmphasis,
  subhead,
  ctas,
}: HeroSectionProps) {
  return (
    <section className="pb-16 pt-20">
      <Kicker as="p">{kicker}</Kicker>
      <h1 className="mt-6 font-display text-[clamp(2.3rem,5.5vw,4.3rem)] font-medium leading-[1.14] text-ink">
        {headlineLead} <em className="text-gold">{headlineEmphasis}</em>
      </h1>
      <p className="mt-6 max-w-[62ch] font-ui text-base leading-relaxed text-ink-dim">{subhead}</p>
      <div className="mt-8 flex flex-wrap gap-6">
        {ctas.map((cta) => (
          <TextLink key={cta.label} href={cta.href} external={cta.external}>
            {cta.label}
          </TextLink>
        ))}
      </div>
    </section>
  );
}

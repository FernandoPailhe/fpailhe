export interface AboutSectionProps {
  text: string;
  photo: string;
}

/** Aside de "about": texto + foto a dos columnas en desktop. */
export function AboutSection({ text, photo }: AboutSectionProps) {
  return (
    <section className="border-t border-line py-16">
      <div className="grid grid-cols-[1fr_220px] items-start gap-8 mobile:grid-cols-1">
        <p className="font-ui text-base leading-relaxed text-ink-dim">{text}</p>
        <img
          src={`/${photo}`}
          alt="Portrait of Fernando Pailhe"
          className="w-full max-w-[220px] border border-line"
        />
      </div>
    </section>
  );
}

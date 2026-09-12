export interface ContactSectionProps {
  heading: string;
  body: string;
  email: string;
}

/** Footer de contacto full-width, invertido (superficie parchment = dark). */
export function ContactSection({ heading, body, email }: ContactSectionProps) {
  return (
    <section id="contact" className="bg-parchment py-20 text-parchment-ink">
      <div className="mx-auto max-w-[880px] px-[clamp(20px,5vw,32px)]">
        <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-medium">{heading}</h2>
        <p className="mt-4 max-w-[60ch] font-ui text-base leading-relaxed text-parchment-ink-dim">
          {body}
        </p>
        <a
          href={`mailto:${email}`}
          className="mt-8 inline-block border-b border-parchment-ink font-ui text-base text-parchment-ink transition-colors hover:border-gold hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright"
        >
          {email}
        </a>
      </div>
    </section>
  );
}

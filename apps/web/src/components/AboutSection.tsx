import { useState } from "react";
import { InitialsAvatar } from "@ferpa/ui";

export interface AboutSectionProps {
  text: string;
  photo: string;
}

/**
 * Aside de "about": texto + foto a dos columnas en desktop.
 *
 * Para reemplazar el fallback del monograma, colocar una foto en
 * `apps/web/public/fernando-photo.jpg` y asegurar que `about-aside.json`
 * tenga `"photo": "fernando-photo.jpg"`.
 */
export function AboutSection({ text, photo }: AboutSectionProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <section className="border-t border-line py-16">
      <div className="grid grid-cols-[1fr_220px] items-start gap-8 mobile:grid-cols-1">
        <p className="font-ui text-base leading-relaxed text-ink-dim">{text}</p>
        {hasError ? (
          <InitialsAvatar initials="FP" className="w-full max-w-[220px]" />
        ) : (
          <img
            src={`/${photo}`}
            alt="Portrait of Fernando Pailhe"
            className="w-full max-w-[220px] border border-line"
            onError={() => setHasError(true)}
          />
        )}
      </div>
    </section>
  );
}

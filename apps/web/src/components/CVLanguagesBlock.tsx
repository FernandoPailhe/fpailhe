import type { Language } from "@ferpa/data-model";
import { CVSectionHeading, LevelDots } from "@ferpa/ui";
import { IconGlobe } from "./CVIcons";

export interface CVLanguagesBlockProps {
  languages: Language[];
}

/** Bloque LANGUAGES del sidebar (solo print): nombre, nivel y barras, centrados. */
export function CVLanguagesBlock({ languages }: CVLanguagesBlockProps) {
  return (
    <section className="break-inside-avoid">
      <CVSectionHeading icon={<IconGlobe />} title="Languages" />
      <ul className="mt-3 space-y-3 print:mt-2 print:space-y-2">
        {languages.map((lang) => (
          <li key={lang.name} className="flex flex-col items-center gap-1">
            <span className="font-ui text-sm text-ink">{lang.name}</span>
            <span className="font-mono text-[11px] text-ink-faint">{lang.label}</span>
            <LevelDots level={lang.level} />
          </li>
        ))}
      </ul>
    </section>
  );
}

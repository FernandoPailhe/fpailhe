import type { Skill } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { IconStar } from "./CVIcons";

export interface CVSkillsBlockProps {
  skills: Skill[];
}

/**
 * Bloque SKILLS del sidebar: lista plana, una skill por línea. Solo se
 * renderiza en print — en pantalla los skills van en `CVSkillsMarquee`.
 */
export function CVSkillsBlock({ skills }: CVSkillsBlockProps) {
  return (
    <section className="break-inside-avoid">
      <CVSectionHeading icon={<IconStar />} title="Skills" />
      <ul className="mt-3 space-y-1 font-ui text-sm text-ink-dim print:mt-2 print:space-y-0 print:text-[11px] print:leading-4">
        {skills.map((skill) => (
          <li key={skill.name}>{skill.name}</li>
        ))}
      </ul>
    </section>
  );
}

import type { Skill } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { IconStar } from "./CVIcons";

export interface CVSkillsBlockProps {
  skills: Skill[];
}

/**
 * Bloque SKILLS del sidebar: lista plana en línea, separada por puntos medios
 * (ocupa menos alto que una skill por línea y deja el sidebar en la hoja 1). Solo se
 * renderiza en print — en pantalla los skills van en `CVSkillsMarquee`.
 */
export function CVSkillsBlock({ skills }: CVSkillsBlockProps) {
  return (
    <section>
      <CVSectionHeading icon={<IconStar />} title="Skills" />
      <ul className="mt-3 font-ui text-sm leading-relaxed text-ink-dim print:mt-2 print:text-[10.5px] print:leading-[15px]">
        {skills.map((skill, i) => (
          <li key={skill.name} className="inline">
            {skill.name}
            {i < skills.length - 1 ? <span className="text-ink-faint"> · </span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

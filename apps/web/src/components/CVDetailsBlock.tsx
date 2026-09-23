import type { Profile } from "@ferpa/data-model";
import { CVSectionHeading } from "@ferpa/ui";
import { AutoLink } from "./AutoLink";
import { IconPin } from "./CVIcons";

export interface CVDetailsBlockProps {
  profile: Profile;
}

/** Bloque DETAILS del sidebar: links de contacto. */
export function CVDetailsBlock({ profile }: CVDetailsBlockProps) {
  return (
    <section>
      <CVSectionHeading icon={<IconPin />} title="Details" />
      <div className="mt-3 space-y-1 font-ui text-sm text-ink-dim print:mt-2 print:space-y-0.5 print:text-[11px] print:leading-4">
        <p><AutoLink value={profile.email} className="hover:text-ink" /></p>
        <p><AutoLink value={profile.linkedin} label="LinkedIn" className="hover:text-ink" /></p>
        <p><AutoLink value={profile.github} label="GitHub" className="hover:text-ink" /></p>
        <p><AutoLink value={profile.domain} className="hover:text-ink" /></p>
      </div>
    </section>
  );
}

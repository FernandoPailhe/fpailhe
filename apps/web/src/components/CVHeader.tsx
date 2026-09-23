import type { Profile } from "@ferpa/data-model";

export interface CVHeaderProps {
  profile: Profile;
}

/**
 * Encabezado del CV: foto circular centrada, nombre en versalitas y línea
 * rol · ubicación · teléfono. Los links de contacto viven en el sidebar
 * (`CVDetailsBlock`), como en el PDF de referencia.
 */
export function CVHeader({ profile }: CVHeaderProps) {
  return (
    <header className="flex flex-col items-center py-10 text-center print:py-3">
      <img
        src={`/${profile.photo}`}
        alt={profile.name}
        className="h-[90px] w-[90px] rounded-full border border-line object-cover print:h-16 print:w-16"
      />
      <h1 className="mt-5 font-display text-3xl font-medium uppercase tracking-[0.15em] text-ink print:mt-3 print:text-2xl">
        {profile.name}
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-ink-dim">
        {profile.role} • {profile.location} • {profile.phone}
      </p>
    </header>
  );
}

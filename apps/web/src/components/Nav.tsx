import { Link } from "react-router-dom";
import { DarkModeToggle } from "./DarkModeToggle";

export interface NavProps {
  links: { label: string; href: string }[];
}

const LINK_CLASS =
  "font-ui text-sm text-ink-dim transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/**
 * Barra de navegación superior. `no-print` para ocultarla en impresión.
 * Las rutas internas usan React Router; anchors y externos, `<a>`.
 */
export function Nav({ links }: NavProps) {
  return (
    <nav aria-label="Main navigation" className="no-print border-b border-line">
      <div className="mx-auto flex max-w-[880px] justify-end px-[clamp(20px,5vw,32px)] py-4">
        <div className="flex items-center gap-6">
          <ul className="flex items-center gap-6">
            {links.map((link) => (
              <li key={link.label}>
                {link.href.startsWith("/") ? (
                  <Link to={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                ) : (
                  <a href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <DarkModeToggle />
        </div>
      </div>
    </nav>
  );
}

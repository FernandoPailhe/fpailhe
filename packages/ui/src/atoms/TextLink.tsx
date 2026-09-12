import type { ReactNode } from "react";

export interface TextLinkProps {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}

/** Link editorial con subrayado fino (border-bottom), no un botón relleno. */
export function TextLink({ href, children, external, className = "" }: TextLinkProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`border-b border-ink font-ui text-ink transition-colors hover:border-gold hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${className}`}
    >
      {children}
      {external ? <span aria-hidden="true"> ↗</span> : null}
    </a>
  );
}

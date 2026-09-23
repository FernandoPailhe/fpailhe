import { toHref } from "@ferpa/data-model";

export interface AutoLinkProps {
  /** String del JSON: si parece URL/dominio/email se vuelve hipervínculo. */
  value: string;
  /** Texto visible; default `value`. */
  label?: string;
  className?: string;
}

/**
 * Renderiza `value` como `<a>` cuando `toHref()` detecta un vínculo
 * (URL, www.dominio, dominio pelado o email) o como texto plano si no.
 * Permite que cualquier JSON con una URL genere hipervínculo sin markup extra.
 */
export function AutoLink({ value, label, className }: AutoLinkProps) {
  const href = toHref(value);
  const text = label ?? value;

  if (!href) return <span className={className}>{text}</span>;

  const external = !href.startsWith("mailto:");
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {text}
    </a>
  );
}

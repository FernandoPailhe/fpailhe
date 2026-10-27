/**
 * Sanitiza SVG inline de contenido de universo: whitelist de elementos y
 * atributos de presentación/geometría. Descarta scripts, handlers `on*`,
 * `style`, `href`/`xlink:href` y cualquier elemento/atributo desconocido.
 * En SSR (sin `DOMParser`) devuelve `null`.
 */

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline",
  "polygon", "defs", "lineargradient", "radialgradient", "stop",
  "title", "desc",
]);

const ALLOWED_ATTRS = new Set([
  "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
  "width", "height", "points", "viewbox", "fill", "stroke",
  "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity",
  "transform", "offset", "stop-color", "id",
]);

function cleanElement(el: Element): void {
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
      el.removeAttribute(attr.name);
    }
  }
  for (const child of [...el.children]) {
    if (ALLOWED_ELEMENTS.has(child.tagName.toLowerCase())) {
      cleanElement(child);
    } else {
      child.remove();
    }
  }
}

/** Devuelve el `<svg>` sanitizado como string, o `null` si no hay un SVG válido. */
export function sanitizeSvg(svg: string): string | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror") !== null) return null;
  const root = doc.querySelector("svg");
  if (root === null) return null;
  cleanElement(root);
  if (!root.hasAttribute("fill")) root.setAttribute("fill", "currentColor");
  return root.outerHTML;
}

/**
 * Utilidades de contraste WCAG puras: parseo de colores y ratio.
 * Soporta `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()` y `oklch()`
 * (los tokens de plataforma y los perfiles estéticos usan oklch).
 */

export interface ParsedColor {
  r: number; // 0–255
  g: number;
  b: number;
  a: number; // 0–1
}

function channel(value: string, base: 16 | 10): number | null {
  const n = base === 16 ? parseInt(value, 16) : parseFloat(value);
  if (!Number.isFinite(n)) return null;
  if (base === 10 && value.trim().endsWith("%")) return (n / 100) * 255;
  return n;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function linearToSrgbChannel(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clamp01(c) * 255;
}

/** OKLCH → sRGB (matrices de Björn Ottosson). L admite `0–1` o `%`. */
function parseOklch(body: string): ParsedColor | null {
  const parts = body.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const rawL = parts[0];
  if (rawL === undefined) return null;
  const l = rawL.endsWith("%") ? parseFloat(rawL) / 100 : parseFloat(rawL);
  const c = parseFloat(parts[1] ?? "");
  const h = parseFloat(parts[2] ?? "");
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return null;

  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l3 = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m3 = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s3 = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);

  return {
    r: linearToSrgbChannel(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    g: linearToSrgbChannel(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    b: linearToSrgbChannel(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
    a: 1,
  };
}

/**
 * Parsea un color CSS a sRGB. Devuelve `null` si el formato no se reconoce
 * (p. ej. `hsl()`, colores con nombre, variables CSS).
 */
export function parseColor(input: string): ParsedColor | null {
  const s = input.trim();

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      const r = channel((hex[0] ?? "") + (hex[0] ?? ""), 16);
      const g = channel((hex[1] ?? "") + (hex[1] ?? ""), 16);
      const b = channel((hex[2] ?? "") + (hex[2] ?? ""), 16);
      const a = hex.length === 4 ? channel((hex[3] ?? "") + (hex[3] ?? ""), 16) : 255;
      if (r === null || g === null || b === null || a === null) return null;
      return { r, g, b, a: a / 255 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = channel(hex.slice(0, 2), 16);
      const g = channel(hex.slice(2, 4), 16);
      const b = channel(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? channel(hex.slice(6, 8), 16) : 255;
      if (r === null || g === null || b === null || a === null) return null;
      return { r, g, b, a: a / 255 };
    }
    return null;
  }

  const rgbMatch = /^rgba?\(\s*(.+)\s*\)$/.exec(s);
  if (rgbMatch && rgbMatch[1] !== undefined) {
    const parts = rgbMatch[1].split(/[\s,/]+/).filter((p) => p.length > 0);
    if (parts.length < 3) return null;
    const r = channel(parts[0] ?? "", 10);
    const g = channel(parts[1] ?? "", 10);
    const b = channel(parts[2] ?? "", 10);
    const rawA = parts[3];
    const a = rawA === undefined ? 1 : parseFloat(rawA) * (rawA.endsWith("%") ? 0.01 : 1);
    if (r === null || g === null || b === null || !Number.isFinite(a)) return null;
    return { r, g, b, a: clamp01(a) };
  }

  const oklchMatch = /^oklch\(\s*(.+)\s*\)$/.exec(s);
  if (oklchMatch && oklchMatch[1] !== undefined) return parseOklch(oklchMatch[1]);

  return null;
}

/** Luminancia relativa WCAG 2.x (0–1) de un color parseado. */
export function relativeLuminance(c: ParsedColor): number {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** Ratio de contraste WCAG (1–21). `null` si algún color no parsea. */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA: 4.5 texto normal, 3 texto grande. */
export function meetsAA(ratio: number | null, size: "normal" | "large"): boolean {
  if (ratio === null) return false;
  return ratio >= (size === "large" ? 3 : 4.5);
}

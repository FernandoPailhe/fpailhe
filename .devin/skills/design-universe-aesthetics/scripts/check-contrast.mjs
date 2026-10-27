#!/usr/bin/env node
// Verifica contraste WCAG de la paleta definida en aesthetic.json (tokens.light / tokens.dark).
// Uso: node .devin/skills/design-universe-aesthetics/scripts/check-contrast.mjs <slug> [--json] [--strict]
import path from "node:path";
import { findRoot, getPaths, assertSlug, readJson, Report, parseArgs, finish } from "../../universe-qa/scripts/lib.mjs";

const { slug, flags } = parseArgs(process.argv.slice(2));
try {
  assertSlug(slug);
} catch (e) {
  console.error(e.message + "\nUso: node check-contrast.mjs <slug> [--json] [--strict]");
  process.exit(2);
}

const aesthetic = readJson(path.join(getPaths(findRoot(), slug).contentDir, "aesthetic.json"));
const tokens = aesthetic.tokens ?? {};
const rep = new Report();

function parseHex(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// [primer plano, fondo, mínimo, descripción]
const PAIRS = [
  ["textPrimary", "background", 4.5, "texto principal sobre fondo"],
  ["textPrimary", "surface", 4.5, "texto principal sobre superficie (carta)"],
  ["textSecondary", "background", 4.5, "texto secundario sobre fondo"],
  ["textSecondary", "surface", 4.5, "texto secundario sobre superficie"],
  ["accentContrast", "accent", 4.5, "texto sobre botón de acento"],
  ["accent", "background", 3, "acento (componentes de UI) sobre fondo"],
  ["positive", "surface", 3, "color positivo sobre superficie"],
  ["negative", "surface", 3, "color negativo sobre superficie"],
  ["warning", "surface", 3, "color de aviso sobre superficie"],
  ["border", "background", 1.5, "borde visible sobre fondo (informativo)"],
];

const results = [];
for (const scheme of ["light", "dark"]) {
  const colors = tokens[scheme];
  if (!colors) {
    if (tokens.defaultScheme === scheme) rep.error("E-SCHEME-MISSING", scheme, `defaultScheme es "${scheme}" pero tokens.${scheme} no existe.`);
    continue;
  }
  for (const [fg, bg, min, label] of PAIRS) {
    const a = parseHex(colors[fg]);
    const b = parseHex(colors[bg]);
    if (!a || !b) {
      rep.error("E-COLOR-FORMAT", `${scheme}.${!a ? fg : bg}`, `color inválido o ausente ("${colors[!a ? fg : bg]}"); usar #RGB o #RRGGBB.`);
      continue;
    }
    const r = ratio(a, b);
    results.push({ scheme, fg, bg, ratio: Number(r.toFixed(2)), min, label });
    if (r < min) (fg === "border" ? rep.warn : rep.error).call(rep, "E-CONTRAST", `${scheme}: ${fg} / ${bg}`, `${label}: ${r.toFixed(2)}:1 (mínimo ${min}:1).`);
  }
}
for (const [paramId, color] of Object.entries(tokens.parameterColors ?? {})) {
  const c = parseHex(color);
  const bg = parseHex((tokens[tokens.defaultScheme] ?? {}).surface);
  if (!c || !bg) continue;
  const r = ratio(c, bg);
  if (r < 3) rep.warn("W-PARAM-COLOR", paramId, `color de parámetro ${color}: ${r.toFixed(2)}:1 sobre la superficie (mínimo 3:1).`);
}

finish(`Contraste · ${slug}`, rep, { results }, flags, (s) => {
  for (const r of s.results) console.log(`  ${r.scheme.padEnd(5)} ${r.fg} / ${r.bg}: ${r.ratio}:1 (mín ${r.min}) — ${r.label}`);
});

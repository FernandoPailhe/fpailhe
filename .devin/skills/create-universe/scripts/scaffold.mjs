#!/usr/bin/env node
// Crea el esqueleto de un universo: carpeta de documentos, carpeta de contenido y state.json.
// Uso: node .devin/skills/create-universe/scripts/scaffold.mjs <slug> "<Nombre>" [--locales=es,en]
import fs from "node:fs";
import path from "node:path";
import { findRoot, getPaths, assertSlug, writeJson, parseArgs } from "../../universe-qa/scripts/lib.mjs";

export const PHASES = ["interview", "research", "bible", "tensions", "entities", "plan", "aesthetics", "cards", "localization", "qa"];

const { slug, rest, flags } = parseArgs(process.argv.slice(2));
const name = rest[0] ?? slug;
try {
  assertSlug(slug);
} catch (e) {
  console.error(e.message + '\nUso: node scaffold.mjs <slug> "<Nombre>" [--locales=es,en]');
  process.exit(2);
}
const localesFlag = [...flags].find((f) => f.startsWith("--locales="));
const locales = localesFlag ? localesFlag.split("=")[1].split(",").filter(Boolean) : ["es", "en"];

const root = findRoot();
const { docDir, contentDir } = getPaths(root, slug);
if (fs.existsSync(docDir)) {
  console.error(`Ya existe ${path.relative(root, docDir)}. No se sobrescribe.`);
  process.exit(1);
}

const skills = path.join(root, ".devin", "skills");
const today = new Date().toISOString().slice(0, 10);
const fill = (text) =>
  text
    .replaceAll("{{slug}}", slug)
    .replaceAll("{{name}}", name)
    .replaceAll("{{date}}", today)
    .replaceAll("{{locales}}", locales.join(", "));

const templates = [
  ["universe-interview/references/brief.template.md", "brief.md"],
  ["universe-bible/references/universe-bible.template.md", "universe-bible.md"],
  ["universe-bible/references/tension-spec.example.json", "tension-spec.json"],
  ["plan-universe-content/references/content-plan.template.json", "content-plan.json"],
];
fs.mkdirSync(path.join(docDir, "research"), { recursive: true });
fs.mkdirSync(path.join(docDir, "inputs"), { recursive: true });
fs.writeFileSync(
  path.join(docDir, "inputs", "README.md"),
  "# inputs/ — material aportado por el usuario\n\nColoca aquí documentos `.md` (o `.txt`) con ideas, lore, reglas, personajes, textos de referencia, notas de estética, cartas de ejemplo, etc.\nLos skills los leen antes de preguntar o investigar. Opcional: un encabezado al inicio del archivo para orientar su uso:\n\n```\n---\nuse: interview   # interview | research | bible | aesthetics | cards\ncanon: true      # true = contenido ya decidido por ti; pasa tal cual al canon\n---\n```\n\nNo hace falta ordenarlos: una idea por archivo y nombres descriptivos ayudan (`faccion-templo.md`, `tono-y-voz.md`).\n",
);
fs.mkdirSync(path.join(contentDir, "cards"), { recursive: true });
for (const [from, to] of templates) {
  const src = path.join(skills, from);
  if (!fs.existsSync(src)) {
    console.error(`Falta la plantilla ${from}`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(docDir, to), fill(fs.readFileSync(src, "utf8")), "utf8");
}
fs.writeFileSync(
  path.join(docDir, "blocked-terms.txt"),
  "# Un término por línea. Nombres de obras, personajes, marcas o artistas protegidos que NO deben aparecer en el contenido.\n",
  "utf8",
);

const now = new Date().toISOString();
writeJson(path.join(docDir, "state.json"), {
  slug,
  name,
  locales,
  createdAt: now,
  updatedAt: now,
  bibleVersion: 0,
  phases: Object.fromEntries(PHASES.map((p) => [p, { status: "pending", approvedAt: null, notes: "" }])),
});

console.log(`Universo "${name}" (${slug}) creado:`);
console.log(`  docs      → ${path.relative(root, docDir)}/`);
console.log(`  contenido → ${path.relative(root, contentDir)}/`);
console.log("Siguiente fase: interview (skill universe-interview).");

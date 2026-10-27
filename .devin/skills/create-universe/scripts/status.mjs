#!/usr/bin/env node
// Tablero de estado de todos los universos (o de uno). Útil para lotes.
// Uso: node .devin/skills/create-universe/scripts/status.mjs [slug] [--write] [--json]
//   --write  escribe doc/universes/_index.md
import fs from "node:fs";
import path from "node:path";
import { findRoot, getPaths, getBaseDir, readJson, parseArgs } from "../../universe-qa/scripts/lib.mjs";

const PHASES = ["interview", "research", "bible", "tensions", "entities", "plan", "aesthetics", "cards", "localization", "qa"];
const ICON = { pending: "·", in_progress: "◐", done: "●", blocked: "✕" };

const { slug: only, flags } = parseArgs(process.argv.slice(2));
const root = findRoot();
const base = getBaseDir(root);
if (!fs.existsSync(base)) {
  console.log(`No hay universos todavía (falta ${path.relative(root, base)}/).`);
  process.exit(0);
}

const slugs = fs
  .readdirSync(base, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, "state.json")))
  .map((d) => d.name)
  .filter((s) => !only || s === only);

const rows = slugs.map((slug) => {
  const { docDir, contentDir } = getPaths(root, slug);
  const state = readJson(path.join(docDir, "state.json"));
  const plan = readJson(path.join(docDir, "content-plan.json"), { slices: [] });
  const planned = (plan.slices ?? []).reduce((n, s) => n + (s.count ?? 0), 0);
  const cardsDir = path.join(contentDir, "cards");
  const written = fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir).filter((f) => f.endsWith(".json")).length : 0;
  const next = PHASES.find((p) => state.phases?.[p]?.status !== "done") ?? "—";
  return { slug, name: state.name, bibleVersion: state.bibleVersion ?? 0, phases: state.phases ?? {}, planned, written, next, updatedAt: state.updatedAt };
});

if (flags.has("--json")) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const header = `| Universo | ${PHASES.map((p) => p.slice(0, 5)).join(" | ")} | Cartas | Biblia | Siguiente |`;
const sep = `| --- | ${PHASES.map(() => ":-:").join(" | ")} | --- | --- | --- |`;
const lines = rows.map(
  (r) =>
    `| ${r.slug} | ${PHASES.map((p) => ICON[r.phases[p]?.status] ?? "?").join(" | ")} | ${r.written}/${r.planned || "?"} | v${r.bibleVersion} | ${r.next} |`,
);
const table = [header, sep, ...lines].join("\n");
console.log(table);
console.log("\nLeyenda: · pendiente  ◐ en curso  ● hecho  ✕ bloqueado");

if (flags.has("--write")) {
  const out = `# Universos\n\n_Generado por \`status.mjs\` — ${new Date().toISOString()}_\n\n${table}\n\nLeyenda: · pendiente · ◐ en curso · ● hecho · ✕ bloqueado\n`;
  fs.writeFileSync(path.join(base, "_index.md"), out, "utf8");
  console.log(`\nEscrito ${path.relative(root, path.join(base, "_index.md"))}`);
}

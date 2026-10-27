// Utilidades compartidas por los scripts de universos. Sin dependencias: solo Node >= 18.
import fs from "node:fs";
import path from "node:path";

/** Sube desde `start` hasta encontrar una carpeta que contenga `.devin/`. */
export function findRoot(start = process.cwd()) {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, ".devin"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`No se encontró .devin/ subiendo desde ${start}`);
    dir = parent;
  }
}

/** Rutas configurables en .devin/universes.config.json (docDir, contentDir). */
export function loadConfig(root) {
  const defaults = { docDir: "doc/universes", contentDir: "apps/web/src/content" };
  const file = path.join(root, ".devin", "universes.config.json");
  if (!fs.existsSync(file)) return defaults;
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (e) {
    throw new Error(`universes.config.json inválido: ${e.message}`);
  }
}

export function getBaseDir(root) {
  return path.join(root, loadConfig(root).docDir);
}

export function getPaths(root, slug) {
  const cfg = loadConfig(root);
  return {
    root,
    docDir: path.join(root, cfg.docDir, slug),
    contentDir: path.join(root, cfg.contentDir, slug),
  };
}

export function assertSlug(slug) {
  if (!slug || !/^[a-z][a-z0-9-]{1,40}$/.test(slug)) {
    throw new Error(`Slug inválido "${slug}". Usar minúsculas, números y guiones (ej. "mi-universo").`);
  }
}

export function readJson(file, fallback) {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Falta el archivo ${file}`);
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`JSON inválido en ${file}: ${e.message}`);
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

/** Devuelve [{ file, card }] ordenado por nombre de archivo. */
export function loadCards(contentDir) {
  const dir = path.join(contentDir, "cards");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: `cards/${f}`, card: readJson(path.join(dir, f)) }));
}

/** Recorre todos los strings de un valor JSON. cb(valor, ruta). */
export function walkStrings(value, cb, trail = "") {
  if (typeof value === "string") cb(value, trail);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, cb, `${trail}[${i}]`));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkStrings(v, cb, trail ? `${trail}.${k}` : k);
  }
}

export function parseArgs(argv) {
  const positional = [];
  const flags = new Set();
  for (const a of argv) (a.startsWith("--") ? flags.add(a) : positional.push(a));
  return { slug: positional[0], rest: positional.slice(1), flags };
}

export class Report {
  constructor() {
    this.issues = [];
  }
  add(severity, code, where, message) {
    this.issues.push({ severity, code, where, message });
  }
  error(code, where, message) {
    this.add("error", code, where, message);
  }
  warn(code, where, message) {
    this.add("warning", code, where, message);
  }
  get errors() {
    return this.issues.filter((i) => i.severity === "error");
  }
  get warnings() {
    return this.issues.filter((i) => i.severity === "warning");
  }
}

/** Imprime el resultado y termina el proceso con el código adecuado. */
export function finish(title, report, summary, flags, renderSummary) {
  const strict = flags.has("--strict");
  const failed = report.errors.length > 0 || (strict && report.warnings.length > 0);
  if (flags.has("--json")) {
    console.log(JSON.stringify({ title, ok: !failed, summary, issues: report.issues }, null, 2));
  } else {
    console.log(`\n== ${title} ==`);
    if (renderSummary) renderSummary(summary);
    const groups = new Map();
    for (const i of report.issues) {
      const key = `${i.severity}:${i.code}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    for (const [key, list] of [...groups].sort()) {
      const [sev, code] = key.split(":");
      console.log(`\n${sev === "error" ? "ERROR" : "AVISO"} ${code} (${list.length})`);
      for (const i of list.slice(0, 12)) console.log(`  - ${i.where}: ${i.message}`);
      if (list.length > 12) console.log(`  … y ${list.length - 12} más (usar --json para verlos todos)`);
    }
    console.log(
      `\nResultado: ${report.errors.length} errores, ${report.warnings.length} avisos${strict ? " (modo estricto)" : ""} → ${failed ? "FALLA" : "OK"}`,
    );
  }
  process.exit(failed ? 1 : 0);
}

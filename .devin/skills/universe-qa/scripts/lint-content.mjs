#!/usr/bin/env node
// Lint de contenido de un universo: ids, textos, longitudes, idiomas, marcadores y términos bloqueados.
// Complementa (no reemplaza) al validador de integridad referencial del motor, cuando exista.
// Uso: node .devin/skills/universe-qa/scripts/lint-content.mjs <slug> [--json] [--strict]
import fs from "node:fs";
import path from "node:path";
import { findRoot, getPaths, assertSlug, readJson, loadCards, walkStrings, Report, parseArgs, finish } from "./lib.mjs";

const { slug, flags } = parseArgs(process.argv.slice(2));
try {
  assertSlug(slug);
} catch (e) {
  console.error(e.message + "\nUso: node lint-content.mjs <slug> [--json] [--strict]");
  process.exit(2);
}

const P = getPaths(findRoot(), slug);
const rep = new Report();
const specFile = path.join(P.docDir, "tension-spec.json");
const spec = fs.existsSync(specFile) ? readJson(specFile) : {};
const rules = {
  maxCardChars: 420,
  maxLabelChars: 90,
  maxOutcomeChars: 260,
  requiredLocales: [],
  strictLocales: false,
  blockedTerms: [],
  ...(spec.content ?? {}),
};
const blockedFile = path.join(P.docDir, "blocked-terms.txt");
if (fs.existsSync(blockedFile)) {
  for (const line of fs.readFileSync(blockedFile, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) rules.blockedTerms.push(t);
  }
}
const blockedRe = rules.blockedTerms.map((t) => ({ t, re: new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu") }));

// ---- Carga ----------------------------------------------------------------
const required = ["game", "stages", "parameters", "aesthetic"];
const optional = ["branches", "characters", "powers", "badges", "icons", "assets"];
const data = {};
for (const name of [...required, ...optional]) {
  const file = path.join(P.contentDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    (required.includes(name) ? rep.error : rep.warn).call(rep, "FILE-MISSING", `${name}.json`, "no existe.");
    continue;
  }
  data[name] = readJson(file);
}
const cards = loadCards(P.contentDir);
const game = data.game;
const defaultLocale = game?.defaultLocale ?? "es";
const gameId = game?.id;

const idSeen = new Map();
function checkId(entity, where) {
  const id = entity?.id;
  if (typeof id !== "string") return rep.error("E-ID-MISSING", where, "falta id.");
  if (!/^off_[A-Za-z0-9_-]+$/.test(id)) rep.error("E-ID-FORMAT", where, `id "${id}" debe empezar con off_ y usar solo [A-Za-z0-9_-].`);
  if (idSeen.has(id)) rep.error("E-ID-DUP", where, `id "${id}" ya usado en ${idSeen.get(id)}.`);
  else idSeen.set(id, where);
  if (gameId && entity.gameId !== undefined && entity.gameId !== gameId) rep.error("E-GAME-MISMATCH", where, `gameId "${entity.gameId}" ≠ "${gameId}".`);
}
if (game) checkId(game, "game.json");
for (const name of ["stages", "branches", "parameters", "characters", "powers", "badges", "icons", "assets"]) {
  (data[name] ?? []).forEach((e, i) => checkId(e, `${name}.json[${i}]`));
}
for (const { file, card } of cards) {
  checkId(card, file);
  (card.options ?? []).forEach((o, i) => checkId(o, `${file}.options[${i}]`));
}

// ---- Textos ----------------------------------------------------------------
const missingLocale = new Map();
function checkLocalized(value, where, limit) {
  if (typeof value?.default !== "string" || value.default.trim() === "") return rep.error("E-TEXT-EMPTY", where, "LocalizedText.default vacío.");
  const text = value.default;
  if (limit && text.length > limit) rep.warn("W-TEXT-LONG", where, `${text.length} caracteres (máx ${limit}).`);
  if (/ {2,}/.test(text)) rep.warn("W-DOUBLE-SPACE", where, "espacios dobles.");
  for (const loc of rules.requiredLocales) {
    if (loc === defaultLocale) continue;
    if (!value.translations?.[loc]?.trim()) {
      if (!missingLocale.has(loc)) missingLocale.set(loc, []);
      missingLocale.get(loc).push(where);
    } else if (limit && value.translations[loc].length > limit * 1.25) {
      rep.warn("W-TEXT-LONG", `${where} [${loc}]`, `${value.translations[loc].length} caracteres (máx ${Math.round(limit * 1.25)} en traducciones).`);
    }
  }
}
const isLoc = (v) => v && typeof v === "object" && typeof v.default === "string";

function checkEntityTexts(list, label, fields) {
  (list ?? []).forEach((e, i) => {
    for (const f of fields) if (e[f] !== undefined) checkLocalized(e[f], `${label}[${i}].${f}`);
  });
}
if (game) {
  checkLocalized(game.title, "game.title");
  checkLocalized(game.description, "game.description");
}
checkEntityTexts(data.stages, "stages", ["name"]);
checkEntityTexts(data.branches, "branches", ["name", "description"]);
checkEntityTexts(data.parameters, "parameters", ["name", "description"]);
checkEntityTexts(data.characters, "characters", ["name", "title"]);
checkEntityTexts(data.powers, "powers", ["name", "description"]);
checkEntityTexts(data.badges, "badges", ["name", "description"]);
checkEntityTexts(data.icons, "icons", ["label"]);

for (const { file, card } of cards) {
  if (card.status !== "published") rep.error("E-CARD-STATUS", file, `status "${card.status}"; las cartas oficiales del build deben estar published.`);
  if (card.origin !== "official") rep.error("E-CARD-ORIGIN", file, `origin "${card.origin}" debe ser official.`);
  const n = card.options?.length ?? 0;
  if (n < 1 || n > 3) rep.error("E-OPTIONS-COUNT", file, `${n} opciones (debe haber 1 a 3).`);
  if ((card.options ?? []).filter((o) => o.kind === "balance").length > 1) rep.error("E-MULTI-BALANCE", file, "más de una opción de equilibrio.");
  if (!Number.isInteger(card.difficulty) || card.difficulty < 1 || card.difficulty > 10) rep.error("E-DIFFICULTY", file, `difficulty ${card.difficulty} fuera de 1..10.`);
  checkLocalized(card.text, `${file}.text`, rules.maxCardChars);
  (card.options ?? []).forEach((o, i) => {
    checkLocalized(o.label, `${file}.options[${i}].label`, rules.maxLabelChars);
    if (o.outcomeText) checkLocalized(o.outcomeText, `${file}.options[${i}].outcomeText`, rules.maxOutcomeChars);
    // Claves internas filtradas al texto visible (ej. "fan_love").
    for (const s of [o.label?.default, o.outcomeText?.default]) {
      if (s && /\b[a-z]{2,}_[a-z_]{2,}\b/.test(s)) rep.warn("W-KEY-LEAK", `${file}.options[${i}]`, `texto con aspecto de clave interna: "${s.match(/\b[a-z]{2,}_[a-z_]{2,}\b/)[0]}".`);
    }
  });
  if (/\b[a-z]{2,}_[a-z_]{2,}\b/.test(card.text?.default ?? "")) rep.warn("W-KEY-LEAK", file, "el texto de la carta contiene algo con aspecto de clave interna.");
}
for (const [loc, where] of missingLocale) {
  (rules.strictLocales ? rep.error : rep.warn).call(rep, "W-LOCALE-MISSING", loc, `${where.length} textos sin traducción "${loc}" (ej. ${where.slice(0, 3).join(", ")}).`);
}

// ---- Marcadores y términos bloqueados (todo el contenido) ------------------
const everything = { ...data, cards: cards.map((c) => c.card) };
const fileOfCard = (trail) => {
  const m = /^cards\[(\d+)\]/.exec(trail);
  return m ? trail.replace(m[0], cards[Number(m[1])].file) : trail;
};
walkStrings(everything, (s0, trail0) => {
  const s = s0;
  const trail = fileOfCard(trail0);
  if ((/\b(TODO|TBD|FIXME|XXX)\b/.test(s) || /\blorem ipsum\b/i.test(s))) rep.error("E-PLACEHOLDER", trail, `marcador pendiente en "${s.slice(0, 50)}".`);
  for (const { t, re } of blockedRe) if (re.test(s)) rep.error("E-BLOCKED-TERM", trail, `contiene el término bloqueado "${t}".`);
});

const summary = { cards: cards.length, ids: idSeen.size, requiredLocales: rules.requiredLocales, blockedTerms: rules.blockedTerms.length };
finish(`Contenido · ${slug}`, rep, summary, flags, (s) => {
  console.log(`Cartas: ${s.cards} · ids únicos: ${s.ids} · idiomas exigidos: ${s.requiredLocales.join(", ") || "(ninguno)"} · términos bloqueados: ${s.blockedTerms}`);
});

#!/usr/bin/env node
// Verifica que las cartas de un universo respeten la guía de tensiones (tension-spec.json).
// Uso: node .devin/skills/universe-qa/scripts/check-tensions.mjs <slug> [--spec-only] [--json] [--strict]
// --spec-only valida solo la estructura de tension-spec.json (no requiere parameters.json ni cartas).
import path from "node:path";
import { findRoot, getPaths, assertSlug, readJson, loadCards, Report, parseArgs, finish } from "./lib.mjs";

const { slug, flags } = parseArgs(process.argv.slice(2));
try {
  assertSlug(slug);
} catch (e) {
  console.error(e.message + "\nUso: node check-tensions.mjs <slug> [--json] [--strict]");
  process.exit(2);
}

const P = getPaths(findRoot(), slug);
const spec = readJson(path.join(P.docDir, "tension-spec.json"));
const specOnly = flags.has("--spec-only");
const parameters = readJson(path.join(P.contentDir, "parameters.json"), specOnly ? [] : undefined);
const cards = loadCards(P.contentDir);
const rep = new Report();

// ---- Preparación -----------------------------------------------------------
const keyById = new Map(parameters.map((p) => [p.id, p.key]));
const specParams = new Map((spec.parameters ?? []).map((p) => [p.key, p]));
const tiers = spec.magnitude?.tiers ?? {};
const rules = [...(spec.difficultyRules ?? [])].sort((a, b) => a.difficulty - b.difficulty);
const optCfg = spec.options ?? {};
const pureTags = new Set(optCfg.pureEffectTags ?? []);
const balanceCfg = optCfg.balance ?? { maxAbsDelta: 4, maxParams: 2 };
const threatSet = new Set(spec.threatTags ?? []);

if (rules.length === 0) rep.error("SPEC-NO-RULES", "tension-spec.json", "difficultyRules está vacío: definir al menos una regla por dificultad.");
// Validaciones estructurales de la spec (siempre)
{
  const names = Object.keys(tiers);
  const sorted = names.map((n) => [n, tiers[n]]).sort((a, b) => a[1][0] - b[1][0]);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][1][0] <= sorted[i - 1][1][1]) rep.error("SPEC-TIER-OVERLAP", "magnitude.tiers", `"${sorted[i - 1][0]}" y "${sorted[i][0]}" se solapan.`);
  }
  for (let d = 1; d <= 10; d++) if (!rules.some((r) => r.difficulty === d)) rep.error("SPEC-DIFFICULTY-GAP", "difficultyRules", `falta la regla para dificultad ${d}.`);
  for (const pair of spec.tensionPairs ?? []) {
    for (const k of [pair.a, pair.b]) if (!specParams.has(k)) rep.error("SPEC-PAIR-UNKNOWN", "tensionPairs", `"${k}" no está en parameters de la spec.`);
  }
  for (const k of specParams.keys()) {
    if (!(spec.tensionPairs ?? []).some((pr) => pr.a === k || pr.b === k)) rep.warn("SPEC-PARAM-NO-PAIR", k, "el parámetro no participa en ningún par de tensión.");
  }
  if (/param_\d/.test(JSON.stringify(spec.parameters ?? []))) rep.error("SPEC-PLACEHOLDER", "parameters", "quedan claves de ejemplo (param_N): reemplazar por las del universo.");
  const ob = spec.quotas?.byOptionsCount ?? {};
  const minSum = Object.values(ob).reduce((a, l) => a + (l.minRatio ?? 0), 0);
  if (minSum > 1) rep.error("SPEC-QUOTA-RATIO", "quotas.byOptionsCount", `la suma de minRatio (${minSum.toFixed(2)}) supera 1.`);
}
if (specOnly) {
  finish(`Spec de tensiones · ${slug}`, rep, { parameters: specParams.size, pairs: (spec.tensionPairs ?? []).length }, flags, (s) => console.log(`Parámetros: ${s.parameters} · pares en tensión: ${s.pairs}`));
}
for (const p of parameters) {
  if (!specParams.has(p.key)) rep.error("SPEC-PARAM-MISSING", "tension-spec.json", `parameters.json define "${p.key}" pero la spec no.`);
}
for (const k of specParams.keys()) {
  if (!parameters.some((p) => p.key === k)) rep.warn("SPEC-PARAM-ORPHAN", "tension-spec.json", `la spec define "${k}" y parameters.json no.`);
}
for (const r of rules) {
  if (!tiers[r.maxTier]) rep.error("SPEC-TIER-UNKNOWN", `difficultyRules[${r.difficulty}]`, `maxTier "${r.maxTier}" no existe en magnitude.tiers.`);
}

function ruleFor(d) {
  let r = rules[0];
  for (const x of rules) if (x.difficulty <= d) r = x;
  return r;
}
const weightOf = (key) => specParams.get(key)?.weight ?? 1;

/** Suma de deltas por clave de parámetro de una opción. */
function vector(option, where) {
  const v = {};
  for (const e of option.effects ?? []) {
    if (e.type !== "modify_parameter") continue;
    const key = keyById.get(e.parameterId);
    if (!key) {
      rep.error("E-PARAM-UNKNOWN", where, `parameterId "${e.parameterId}" no existe en parameters.json.`);
      continue;
    }
    v[key] = (v[key] ?? 0) + e.delta;
  }
  return v;
}

// ---- Acumuladores ----------------------------------------------------------
const sums = {};
const standardOptionCount = { n: 0 };
const pairStats = (spec.tensionPairs ?? []).map((p) => ({ ...p, options: 0, cards: new Set() }));
const optionsByCount = { 1: 0, 2: 0, 3: 0 };
let pureCards = 0;
let optionsTotal = 0;

// ---- Reglas por carta/opción ----------------------------------------------
for (const { file, card } of cards) {
  const opts = card.options ?? [];
  optionsByCount[opts.length] = (optionsByCount[opts.length] ?? 0) + 1;
  const rule = ruleFor(card.difficulty ?? 1);
  const cap = rule ? tiers[rule.maxTier]?.[1] : undefined;
  const allowPure = (card.themeTags ?? []).some((t) => pureTags.has(t));
  if (allowPure) pureCards++;
  const vectors = [];

  for (const opt of opts) {
    optionsTotal++;
    const where = `${file} · ${opt.id}`;
    const v = vector(opt, where);
    vectors.push({ opt, v });
    const keys = Object.keys(v).filter((k) => v[k] !== 0);
    const isBalance = opt.kind === "balance";

    for (const t of opt.threatTags ?? []) {
      if (!threatSet.has(t)) rep.error("E-THREAT-UNKNOWN", where, `threatTag "${t}" no está declarado en spec.threatTags.`);
    }

    if (isBalance) {
      if (keys.length > (balanceCfg.maxParams ?? 2)) rep.error("E-BALANCE-PARAMS", where, `la opción de equilibrio toca ${keys.length} parámetros (máx ${balanceCfg.maxParams ?? 2}).`);
      for (const k of keys) {
        if (Math.abs(v[k]) > (balanceCfg.maxAbsDelta ?? 4)) rep.error("E-BALANCE-DELTA", where, `|Δ ${k}| = ${Math.abs(v[k])} supera el máximo de equilibrio (${balanceCfg.maxAbsDelta ?? 4}).`);
      }
      if (!opt.availability && !opt.unlockTag) rep.warn("W-BALANCE-UNGATED", where, "la opción de equilibrio no tiene availability ni unlockTag.");
      continue; // las opciones de equilibrio no cuentan para sesgo ni tradeoff
    }

    standardOptionCount.n++;
    for (const key of specParams.keys()) sums[key] = (sums[key] ?? 0) + (v[key] ?? 0);

    if (keys.length === 0) {
      if (opts.length > 1) rep.warn("W-NO-PARAM-EFFECT", where, "opción estándar sin ningún modify_parameter.");
      continue;
    }
    if (rule && keys.length > rule.maxParams) rep.error("E-PARAMS-CAP", where, `toca ${keys.length} parámetros; dificultad ${card.difficulty} permite ${rule.maxParams}.`);
    if (cap !== undefined) {
      for (const k of keys) {
        if (Math.abs(v[k]) > cap) rep.error("E-TIER-CAP", where, `|Δ ${k}| = ${Math.abs(v[k])} supera el tope ${cap} (${rule.maxTier}) para dificultad ${card.difficulty}.`);
      }
    }
    const minNoise = tiers.minor?.[0];
    if (minNoise !== undefined) {
      for (const k of keys) if (Math.abs(v[k]) < minNoise) rep.warn("W-DELTA-NOISE", where, `|Δ ${k}| = ${Math.abs(v[k])} es menor al mínimo significativo (${minNoise}).`);
    }
    const net = keys.reduce((s, k) => s + weightOf(k) * v[k], 0);
    if (rule?.netMax !== undefined) {
      if (net > rule.netMax) rep.error("E-FREE-LUNCH", where, `balance neto ponderado +${net} supera +${rule.netMax}: la opción es demasiado favorable.`);
      if (net < -rule.netMax) rep.warn("W-PUNISHING", where, `balance neto ponderado ${net} está por debajo de -${rule.netMax}: opción demasiado castigadora.`);
    }
    if (opts.length > 1 && optCfg.requireTradeoff !== false && !allowPure) {
      const pos = keys.some((k) => v[k] > 0);
      const neg = keys.some((k) => v[k] < 0);
      if (!(pos && neg)) rep.error("E-TRADEOFF", where, `opción sin trade-off (${pos ? "solo sube" : "solo baja"}). Añadir un costo o marcar la carta con un tag de excepción (${[...pureTags].join(", ") || "ninguno definido"}).`);
    }

    for (const pair of pairStats) {
      if ((v[pair.a] ?? 0) * (v[pair.b] ?? 0) < 0) {
        pair.options++;
        pair.cards.add(file);
      }
    }
  }

  // Opciones dominadas o indistinguibles dentro de la misma carta.
  const std = vectors.filter((x) => x.opt.kind !== "balance" && Object.keys(x.v).length > 0);
  for (let i = 0; i < std.length; i++) {
    for (let j = 0; j < std.length; j++) {
      if (i === j) continue;
      const a = std[i].v;
      const b = std[j].v;
      const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
      let allGE = true;
      let someGT = false;
      let allEQ = true;
      for (const k of ks) {
        const x = a[k] ?? 0;
        const y = b[k] ?? 0;
        if (x < y) allGE = false;
        if (x > y) someGT = true;
        if (x !== y) allEQ = false;
      }
      if (allEQ && i < j) rep.warn("W-DUP-OPTIONS", `${file}`, `${std[i].opt.id} y ${std[j].opt.id} tienen exactamente los mismos efectos.`);
      else if (allGE && someGT) rep.warn("W-DOMINATED", `${file}`, `${std[j].opt.id} está dominada por ${std[i].opt.id} (nunca conviene elegirla).`);
    }
  }
}

// ---- Reglas globales -------------------------------------------------------
const totalCards = cards.length;
const pureRatio = totalCards ? pureCards / totalCards : 0;
if (optCfg.maxPureRatio !== undefined && pureRatio > optCfg.maxPureRatio) {
  rep.warn("W-PURE-RATIO", "global", `${(pureRatio * 100).toFixed(0)}% de las cartas usa tags de excepción (máx ${(optCfg.maxPureRatio * 100).toFixed(0)}%).`);
}

const bias = {};
for (const key of specParams.keys()) {
  bias[key] = standardOptionCount.n ? sums[key] / standardOptionCount.n : 0;
  const expected = specParams.get(key).expectedBias ?? 0;
  const tol = spec.bias?.tolerance ?? 1.0;
  if (Math.abs(bias[key] - expected) > tol) {
    rep.warn("W-BIAS", key, `Δ medio por opción = ${bias[key].toFixed(2)} (esperado ${expected} ± ${tol}). El parámetro deriva ${bias[key] > expected ? "hacia arriba" : "hacia abajo"} en promedio.`);
  }
}

const pairMin = spec.coverage?.pairMinOptions ?? 3;
for (const p of pairStats) {
  if (p.options < pairMin) rep.warn("W-PAIR-COVERAGE", `${p.a} ↔ ${p.b}`, `solo ${p.options} opciones ejercitan este par en tensión (mínimo ${pairMin}).`);
}
const used = new Set();
for (const { card } of cards) for (const o of card.options ?? []) for (const t of o.threatTags ?? []) used.add(t);
for (const t of threatSet) if (!used.has(t)) rep.warn("W-THREAT-UNUSED", t, "threatTag declarado y ninguna opción lo usa.");

const q = spec.quotas ?? {};
if (q.total?.min !== undefined && totalCards < q.total.min) rep.warn("W-QUOTA-TOTAL", "global", `hay ${totalCards} cartas; objetivo mínimo ${q.total.min}.`);
for (const [order, lim] of Object.entries(q.byStageOrder ?? {})) {
  const s = Number(order);
  const n = cards.filter(({ card }) => (card.availability?.minStageOrder ?? -Infinity) <= s && s <= (card.availability?.maxStageOrder ?? Infinity)).length;
  if (lim.min !== undefined && n < lim.min) rep.warn("W-QUOTA-STAGE", `etapa ${s}`, `${n} cartas elegibles; mínimo ${lim.min}.`);
}
for (const [count, lim] of Object.entries(q.byOptionsCount ?? {})) {
  const ratio = totalCards ? (optionsByCount[count] ?? 0) / totalCards : 0;
  if (lim.minRatio !== undefined && ratio < lim.minRatio) rep.warn("W-QUOTA-OPTIONS", `${count} opciones`, `${(ratio * 100).toFixed(0)}% de las cartas; mínimo ${(lim.minRatio * 100).toFixed(0)}%.`);
  if (lim.maxRatio !== undefined && ratio > lim.maxRatio) rep.warn("W-QUOTA-OPTIONS", `${count} opciones`, `${(ratio * 100).toFixed(0)}% de las cartas; máximo ${(lim.maxRatio * 100).toFixed(0)}%.`);
}

const summary = {
  cards: totalCards,
  options: optionsTotal,
  optionsByCount,
  pureRatio,
  meanDeltaPerOption: bias,
  pairCoverage: pairStats.map((p) => ({ a: p.a, b: p.b, intensity: p.intensity, options: p.options, cards: p.cards.size })),
};

finish(`Tensiones · ${slug}`, rep, summary, flags, (s) => {
  console.log(`Cartas: ${s.cards} · opciones: ${s.options} · distribución por nº de opciones: ${JSON.stringify(s.optionsByCount)}`);
  console.log(`Δ medio por opción estándar: ${Object.entries(s.meanDeltaPerOption).map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`).join(" · ")}`);
  console.log("Cobertura de pares en tensión:");
  for (const p of s.pairCoverage) console.log(`  ${p.a} ↔ ${p.b} (intensidad ${p.intensity ?? "?"}): ${p.options} opciones en ${p.cards} cartas`);
});

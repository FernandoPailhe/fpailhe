#!/usr/bin/env node
// Actualiza el estado de una fase en doc/universes/<slug>/state.json.
// Uso: node .devin/skills/create-universe/scripts/set-phase.mjs <slug> <fase> <pending|in_progress|done|blocked> ["nota"] [--bible-version=N]
import path from "node:path";
import { findRoot, getPaths, assertSlug, readJson, writeJson, parseArgs } from "../../universe-qa/scripts/lib.mjs";

const PHASES = ["interview", "research", "bible", "tensions", "entities", "plan", "aesthetics", "cards", "localization", "qa"];
const STATUSES = ["pending", "in_progress", "done", "blocked"];

const { slug, rest, flags } = parseArgs(process.argv.slice(2));
const [phase, status, note = ""] = rest;
try {
  assertSlug(slug);
  if (!PHASES.includes(phase)) throw new Error(`Fase inválida "${phase}". Opciones: ${PHASES.join(", ")}`);
  if (!STATUSES.includes(status)) throw new Error(`Estado inválido "${status}". Opciones: ${STATUSES.join(", ")}`);
} catch (e) {
  console.error(e.message + '\nUso: node set-phase.mjs <slug> <fase> <estado> ["nota"] [--bible-version=N]');
  process.exit(2);
}

const file = path.join(getPaths(findRoot(), slug).docDir, "state.json");
const state = readJson(file);
const now = new Date().toISOString();
state.phases[phase] = {
  status,
  approvedAt: status === "done" ? now : null,
  notes: note || state.phases[phase]?.notes || "",
};
const bv = [...flags].find((f) => f.startsWith("--bible-version="));
if (bv) state.bibleVersion = Number(bv.split("=")[1]);
state.updatedAt = now;
writeJson(file, state);
console.log(`${slug}: ${phase} → ${status}${note ? ` (${note})` : ""}`);

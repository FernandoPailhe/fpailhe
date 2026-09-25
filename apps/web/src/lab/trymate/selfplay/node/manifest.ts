import { cpus } from "node:os";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExperimentConfig } from "../core/experiment";

export const BATCH_MANIFEST_SCHEMA = "trymate.batch/1" as const;

export interface BatchManifest {
  schema: typeof BATCH_MANIFEST_SCHEMA;
  batchId: string;
  experiment: ExperimentConfig;
  gitSha: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "completed" | "interrupted";
  gamesPlanned: number;
  gamesDone: number;
  failures: number;
  /** fingerprint de cada variante del experimento. */
  fingerprints: Record<string, string>;
  bots: string[];
  machine: { cpu: string; cores: number; node: string };
  gamesPerHour: number;
}

export const manifestPath = (dir: string): string => join(dir, "manifest.json");

export function newManifest(
  batchId: string,
  experiment: ExperimentConfig,
  gitSha: string | null,
  fingerprints: Record<string, string>,
  bots: string[],
  gamesPlanned: number,
): BatchManifest {
  return {
    schema: BATCH_MANIFEST_SCHEMA,
    batchId,
    experiment,
    gitSha,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "running",
    gamesPlanned,
    gamesDone: 0,
    failures: 0,
    fingerprints,
    bots,
    machine: {
      cpu: cpus()[0]?.model ?? "unknown",
      cores: cpus().length,
      node: process.version,
    },
    gamesPerHour: 0,
  };
}

/** Escritura atómica (tmp + rename) — segura para reescrituras periódicas. */
export async function writeManifest(dir: string, m: BatchManifest): Promise<void> {
  const tmp = `${manifestPath(dir)}.tmp`;
  await writeFile(tmp, `${JSON.stringify(m, null, 2)}\n`);
  await rename(tmp, manifestPath(dir));
}

export async function readManifest(dir: string): Promise<BatchManifest> {
  const raw = await readFile(manifestPath(dir), "utf8");
  const m = JSON.parse(raw) as BatchManifest;
  if (m.schema !== BATCH_MANIFEST_SCHEMA) {
    throw new Error(`manifest con schema desconocido: ${m.schema}`);
  }
  return m;
}

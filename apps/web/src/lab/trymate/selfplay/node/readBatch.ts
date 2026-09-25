import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { validateGameRecord, type GameRecord } from "../core/record";
import { readManifest } from "./manifest";

export interface BatchReadResult {
  /** Registros válidos entregados a onRecord. */
  read: number;
  /** Líneas de shard que no parsean o no validan. */
  invalid: number;
  /** Fallas registradas por el runner (failures.jsonl + manifest). */
  reportedFailures: number;
  batchId: string | null;
  invalidErrors: string[];
}

/**
 * Recorre un batch en streaming: shards games-*.jsonl.gz línea a línea,
 * validando cada registro. Las líneas inválidas se cuentan y no cortan la
 * lectura. Memoria O(1) respecto al tamaño del batch.
 */
export async function readBatch(
  dir: string,
  onRecord: (r: GameRecord) => void | Promise<void>,
): Promise<BatchReadResult> {
  const result: BatchReadResult = {
    read: 0,
    invalid: 0,
    reportedFailures: 0,
    batchId: null,
    invalidErrors: [],
  };

  try {
    const m = await readManifest(dir);
    result.batchId = m.batchId;
    result.reportedFailures = m.failures;
  } catch {
    result.batchId = basename(dir);
  }

  const files = (await readdir(dir)).filter((f) => /^games-\d+\.jsonl\.gz$/.test(f)).sort();
  for (const f of files) {
    const rl = createInterface({
      input: createReadStream(join(dir, f)).pipe(createGunzip()),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        result.invalid += 1;
        continue;
      }
      const v = validateGameRecord(parsed);
      if (!v.ok) {
        result.invalid += 1;
        if (result.invalidErrors.length < 10) {
          result.invalidErrors.push(`${f}: ${v.errors[0] ?? "registro inválido"}`);
        }
        continue;
      }
      result.read += 1;
      await onRecord(v.record);
    }
  }

  try {
    const raw = await readFile(join(dir, "failures.jsonl"), "utf8");
    const lines = raw.split("\n").filter((l) => l.trim() !== "").length;
    result.reportedFailures = Math.max(result.reportedFailures, lines);
  } catch {
    // sin failures.jsonl
  }
  return result;
}

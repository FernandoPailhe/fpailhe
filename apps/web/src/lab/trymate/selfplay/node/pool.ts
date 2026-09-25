import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import type { GameSpecDescriptor } from "../core/experiment";
import type { GameRecord } from "../core/record";
import type { WorkerResponse } from "./worker";

export const resolveWorkerCount = (w: number | "auto"): number =>
  w === "auto" ? Math.max(1, cpus().length - 1) : w;

export interface PoolOptions {
  workerFile: string;
  workers: number;
  queue: readonly GameSpecDescriptor[];
  /** Si devuelve true, no se reparten más partidas (las en curso terminan). */
  shouldStop?: () => boolean;
  onRecord: (record: GameRecord) => void | Promise<void>;
  onFailure: (d: GameSpecDescriptor, error: string) => void | Promise<void>;
}

/** Un request por worker a la vez (cada worker procesa en orden). */
function request(w: Worker, d: GameSpecDescriptor): Promise<WorkerResponse> {
  return new Promise((resolve) => {
    const onMsg = (msg: WorkerResponse): void => {
      if (msg.id !== d.id) return;
      w.off("message", onMsg);
      w.off("error", onErr);
      w.off("exit", onExit);
      resolve(msg);
    };
    const onErr = (err: Error): void => {
      w.off("message", onMsg);
      w.off("exit", onExit);
      resolve({ ok: false, id: d.id, error: `worker error: ${err.message}` });
    };
    const onExit = (code: number): void => {
      w.off("message", onMsg);
      w.off("error", onErr);
      resolve({ ok: false, id: d.id, error: `worker terminó (code ${code})` });
    };
    w.on("message", onMsg);
    w.once("error", onErr);
    w.once("exit", onExit);
    w.postMessage(d);
  });
}

/**
 * Reparte descriptores entre workers hasta agotar la cola (o `shouldStop`).
 * Cada worker corre materializeSpec + playRecordedGame; el main nunca toca
 * estado de juego — solo ordena resultados.
 */
export async function runGamePool(opts: PoolOptions): Promise<void> {
  let i = 0;
  const next = (): GameSpecDescriptor | undefined =>
    opts.shouldStop?.() ? undefined : opts.queue[i++];

  const lanes = Array.from({ length: Math.min(opts.workers, opts.queue.length) }, () => {
    return new Worker(opts.workerFile);
  });
  try {
    await Promise.all(
      lanes.map(async (w) => {
        for (let d = next(); d !== undefined; d = next()) {
          const res = await request(w, d);
          if (res.ok) await opts.onRecord(res.record);
          else await opts.onFailure(d, res.error);
        }
      }),
    );
  } finally {
    await Promise.all(lanes.map((w) => w.terminate()));
  }
}

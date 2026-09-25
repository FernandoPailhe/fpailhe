import { parentPort } from "node:worker_threads";
import { materializeSpec, type GameSpecDescriptor } from "../core/experiment";
import { playRecordedGame } from "../core/playRecordedGame";
import type { GameRecord } from "../core/record";

export type WorkerResponse =
  { ok: true; id: string; record: GameRecord } | { ok: false; id: string; error: string };

/**
 * Worker del pool selfplay: recibe GameSpecDescriptor serializables, los
 * materializa (resuelve bots, incluido Hard lazy) y juega la partida grabada.
 * Una acción ilegal NO entra al registro: se reporta como failure.
 */
const port = parentPort;
if (port) {
  port.on("message", (d: GameSpecDescriptor) => {
    void (async () => {
      try {
        const spec = await materializeSpec(d);
        const record = await playRecordedGame(spec);
        const res: WorkerResponse = { ok: true, id: d.id, record };
        port.postMessage(res);
      } catch (err) {
        const res: WorkerResponse = {
          ok: false,
          id: d.id,
          error: (err as Error).stack ?? String(err),
        };
        port.postMessage(res);
      }
    })();
  });
}

import { runHardRequest } from "./runHardRequest";
import type { HardRequest, HardResponse } from "./protocol";

// Vite compila este archivo como worker module separado:
// `new Worker(new URL("./hard.worker.ts", import.meta.url), { type: "module" })`.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<HardRequest>) => void) | null;
  postMessage(msg: HardResponse): void;
};

scope.onmessage = (e: MessageEvent<HardRequest>) => {
  const req = e.data;
  try {
    const result = runHardRequest(req);
    scope.postMessage({ id: req.id, ok: true, result });
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: String(err) });
  }
};

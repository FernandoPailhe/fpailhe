import { HARD_BOT_CONFIG } from "./config";
import { runHardRequest } from "./runHardRequest";
import type { HardRequest, HardResponse, SerializedArmyPlan } from "./protocol";
import type { HardSearchResult } from "./search";

type HardResult = HardSearchResult | SerializedArmyPlan;

export interface HardBotClientOpts {
  /** Forzar el camino inline aunque exista Worker (tests). */
  forceInline?: boolean;
  /** Presupuesto de búsqueda inline (default: config global). */
  fallbackBudget?: HardRequest["budget"];
  /** Presupuesto de planificación inline (default: config global). */
  inlineSetupBudget?: { candidates: number; nodesPerEval: number };
}

const abortError = (): Error =>
  Object.assign(new Error("búsqueda abortada"), { name: "AbortError" });

/** Tiempo extra sobre el presupuesto antes de declarar al worker colgado. */
const TIMEOUT_SLACK_MS = 1500;
const NODE_TIMEOUT_MS = 10_000;

interface Pending {
  resolve: (r: HardResult) => void;
  reject: (e: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  onAbort: () => void;
  signal: AbortSignal;
}

/**
 * Cliente del worker de Hard. En navegador corre la búsqueda en un worker
 * (lazy) con timeout de seguridad y reintento inline; en jsdom/tests (sin
 * `Worker`) cae al fallback en el hilo con `fallbackBudget`. El abort de una
 * búsqueda en curso termina el worker (única forma de cortar el cálculo) y
 * se recrea perezosamente en la próxima llamada.
 */
export class HardBotClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private disposed = false;

  constructor(private readonly opts: HardBotClientOpts = {}) {}

  /** Búsqueda de jugada (kind "play"). */
  search(req: HardRequest, signal: AbortSignal): Promise<HardSearchResult> {
    return this.send(req, signal) as Promise<HardSearchResult>;
  }

  /** Planificación de ejército (kind "setup"). */
  plan(req: HardRequest, signal: AbortSignal): Promise<SerializedArmyPlan> {
    return this.send(req, signal) as Promise<SerializedArmyPlan>;
  }

  dispose(): void {
    this.disposed = true;
    this.killWorker(abortError());
  }

  private send(req: HardRequest, signal: AbortSignal): Promise<HardResult> {
    if (this.disposed) return Promise.reject(new Error("HardBotClient: disposed"));
    if (signal.aborted) return Promise.reject(abortError());
    if (typeof Worker === "undefined" || this.opts.forceInline) {
      return this.searchInline(req, signal);
    }
    return this.searchWorker(req, signal);
  }

  private searchInline(req: HardRequest, signal: AbortSignal): Promise<HardResult> {
    return Promise.resolve().then(() => {
      if (signal.aborted) throw abortError();
      const inlineReq =
        req.kind === "setup"
          ? {
              ...req,
              setupBudget: this.opts.inlineSetupBudget ?? HARD_BOT_CONFIG.inlineSetupBudget,
            }
          : { ...req, budget: this.opts.fallbackBudget ?? HARD_BOT_CONFIG.fallbackBudget };
      const result = runHardRequest(inlineReq);
      if (signal.aborted) throw abortError();
      return result;
    });
  }

  private searchWorker(req: HardRequest, signal: AbortSignal): Promise<HardResult> {
    return new Promise<HardResult>((resolve, reject) => {
      const timeoutMs =
        req.budget.kind === "time" ? req.budget.ms + TIMEOUT_SLACK_MS : NODE_TIMEOUT_MS;
      const onAbort = () => this.killWorker(abortError());
      // Worker colgado: sacar esta request de pendientes, terminar el worker y
      // reintentar una vez inline con el presupuesto de fallback.
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        signal.removeEventListener("abort", onAbort);
        this.worker?.terminate();
        this.worker = null;
        if (signal.aborted) {
          reject(abortError());
          return;
        }
        this.searchInline(req, signal).then(resolve, reject);
      }, timeoutMs);
      const entry: Pending = { resolve, reject, signal, onAbort, timer };
      signal.addEventListener("abort", onAbort, { once: true });
      this.pending.set(req.id, entry);
      try {
        this.ensureWorker().postMessage(req);
      } catch (err) {
        this.pending.delete(req.id);
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        this.searchInline(req, signal).then(resolve, () => reject(err));
      }
    });
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      const w = new Worker(new URL("./hard.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<HardResponse>) => this.onMessage(e.data);
      w.onerror = () => this.killWorker(new Error("hard worker error"));
      this.worker = w;
    }
    return this.worker;
  }

  private onMessage(resp: HardResponse): void {
    const entry = this.pending.get(resp.id);
    if (!entry) return;
    this.pending.delete(resp.id);
    clearTimeout(entry.timer);
    entry.signal.removeEventListener("abort", entry.onAbort);
    if (entry.signal.aborted) {
      entry.reject(abortError());
    } else if (resp.ok) {
      entry.resolve(resp.result);
    } else {
      entry.reject(new Error(resp.error));
    }
  }

  /** Termina el worker y rechaza todo lo pendiente con `err`. */
  private killWorker(err: unknown): void {
    this.worker?.terminate();
    this.worker = null;
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const e of entries) {
      clearTimeout(e.timer);
      e.signal.removeEventListener("abort", e.onAbort);
      e.reject(err);
    }
  }
}

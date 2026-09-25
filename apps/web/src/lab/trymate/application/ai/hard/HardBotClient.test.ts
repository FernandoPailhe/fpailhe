import { afterEach, describe, expect, it, vi } from "vitest";
import { Board } from "../../../domain/entities/Board";
import { GamePiece } from "../../../domain/entities/GamePiece";
import { PlayerState } from "../../../domain/entities/PlayerState";
import { Position } from "../../../domain/entities/Position";
import { PieceType, Player } from "../../../domain/constants/PieceConstants";
import { SetupTurnMode } from "../../../domain/constants/GameRules";
import { CURRENT_RULES } from "../../../domain/config/RulesView";
import { MovementRuleEngine } from "../../rules/MovementRuleEngine";
import type { BotContext } from "../ComputerPlayer";
import { createSeededRng } from "../rng";
import { toHardRequest, type HardRequest, type HardResponse } from "./protocol";
import { runHardRequest } from "./runHardRequest";
import { HardBotClient } from "./HardBotClient";

const rules = CURRENT_RULES;
const engine = new MovementRuleEngine();
const BOT = Player.NEGRAS;
const pos = (x: number, y: number) => new Position(x, y);

const makeCtx = (): BotContext => {
  const board = new Board(rules.width, rules.height);
  board.addPiece(new GamePiece("n1", PieceType.STRIKER, pos(2, 5), BOT));
  board.addPiece(new GamePiece("b1", PieceType.FORT, pos(1, 4), Player.BLANCAS));
  return {
    board,
    bot: BOT,
    botState: new PlayerState("bot"),
    opponentState: new PlayerState("opp"),
    engine,
    rules,
    setupMode: SetupTurnMode.ALTERNATING,
    rng: createSeededRng(1),
  };
};

const BUDGET = { kind: "nodes", n: 2_000 } as const;

/** Worker falso: corre runHardRequest en el hilo via setTimeout. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: { data: HardResponse }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  terminated = false;
  constructor(
    public readonly url: URL,
    public readonly options?: { type?: string },
  ) {
    FakeWorker.instances.push(this);
  }
  postMessage(data: HardRequest): void {
    setTimeout(() => {
      if (this.terminated) return;
      try {
        const result = runHardRequest(data);
        this.onmessage?.({ data: { id: data.id, ok: true, result } });
      } catch (err) {
        this.onmessage?.({ data: { id: data.id, ok: false, error: String(err) } });
      }
    }, 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances.length = 0;
});

describe("HardBotClient — fallback inline (sin Worker)", () => {
  it("resuelve una búsqueda con el presupuesto de fallback", async () => {
    const client = new HardBotClient({ forceInline: true });
    const req = toHardRequest(makeCtx(), BUDGET, 9, 1, "balanced");
    const res = await client.search(req, new AbortController().signal);
    expect(res.actions.length).toBeGreaterThan(0);
    expect(res.nodes).toBeGreaterThan(0);
    client.dispose();
  });

  it("abort previo → rechaza con AbortError", async () => {
    const client = new HardBotClient({ forceInline: true });
    const ctl = new AbortController();
    ctl.abort();
    const req = toHardRequest(makeCtx(), BUDGET, 9, 1, "balanced");
    await expect(client.search(req, ctl.signal)).rejects.toMatchObject({ name: "AbortError" });
    client.dispose();
  });
});

describe("HardBotClient — worker", () => {
  it("mapea respuestas por id y resuelve dos búsquedas concurrentes", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = new HardBotClient();
    const req1 = toHardRequest(makeCtx(), BUDGET, 1, 10, "balanced");
    const req2 = toHardRequest(makeCtx(), BUDGET, 2, 11, "offensive");
    const [r1, r2] = await Promise.all([
      client.search(req1, new AbortController().signal),
      client.search(req2, new AbortController().signal),
    ]);
    expect(r1.actions.length).toBeGreaterThan(0);
    expect(r2.actions.length).toBeGreaterThan(0);
    expect(FakeWorker.instances).toHaveLength(1);
    client.dispose();
  });

  it("abort durante la búsqueda → termina el worker y rechaza con AbortError", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = new HardBotClient();
    const ctl = new AbortController();
    const req = toHardRequest(makeCtx(), BUDGET, 3, 20, "balanced");
    const p = client.search(req, ctl.signal);
    ctl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
    client.dispose();
  });

  it("worker que responde error → rechaza con el mensaje", async () => {
    class FailWorker extends FakeWorker {
      override postMessage(data: HardRequest): void {
        setTimeout(() => {
          this.onmessage?.({ data: { id: data.id, ok: false, error: "boom" } });
        }, 0);
      }
    }
    vi.stubGlobal("Worker", FailWorker);
    const client = new HardBotClient();
    const req = toHardRequest(makeCtx(), BUDGET, 4, 30, "balanced");
    await expect(client.search(req, new AbortController().signal)).rejects.toThrow("boom");
    client.dispose();
  });
});

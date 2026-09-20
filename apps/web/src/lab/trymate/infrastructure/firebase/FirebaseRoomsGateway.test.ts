import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "firebase/database";
import { Player } from "../../domain/constants/PieceConstants";
import { GamePhase } from "../../domain/constants/GameRules";
import type { GameSnapshot } from "../../domain/entities/GameSnapshot";
import type { RoomRecord } from "../../domain/interfaces/RoomsGateway";
import { FirebaseRoomsGateway } from "./FirebaseRoomsGateway";

type Data = Record<string, unknown>;

/**
 * Fake mínimo de RTDB: store plano path→record, listeners que re-emiten en
 * cada mutación (como onValue) y una cola de operaciones onDisconnect que el
 * test "dispara" manualmente simulando la caída del socket.
 */
const fake = vi.hoisted(() => {
  const TS = Symbol("serverTimestamp");
  const store = new Map<string, Data>();
  const listeners = new Map<string, Set<() => void>>();
  const disconnectOps = new Map<string, Data>();
  let pushCounter = 0;
  return { TS, store, listeners, disconnectOps, nextPushKey: () => `room-fake-${++pushCounter}` };
});

vi.mock("firebase/database", () => {
  interface FakeRef {
    path: string;
    key?: string | null;
  }
  interface Clause {
    kind: "orderByChild" | "equalTo";
    key?: string;
    value?: unknown;
  }
  type FakeQuery = FakeRef & { clauses?: Clause[] };

  const resolveTs = (value: unknown): unknown => (value === fake.TS ? Date.now() : value);
  const resolveAll = (data: Data): Data =>
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, resolveTs(v)]));

  const getAt = (path: string): unknown => {
    if (fake.store.has(path)) return fake.store.get(path);
    const prefix = `${path}/`;
    const children: Data = {};
    for (const [key, value] of fake.store) {
      if (key.startsWith(prefix)) children[key.slice(prefix.length)] = value;
    }
    return Object.keys(children).length > 0 ? children : null;
  };

  const emit = (changedPath: string): void => {
    for (const [listenerPath, cbs] of fake.listeners) {
      if (listenerPath === changedPath || changedPath.startsWith(`${listenerPath}/`)) {
        cbs.forEach((cb) => cb());
      }
    }
  };

  return {
    ref: (_db: unknown, path: string): FakeRef => ({ path }),
    push: (parent: FakeRef): FakeRef => {
      const key = fake.nextPushKey();
      return { path: `${parent.path}/${key}`, key };
    },
    set: async (r: FakeRef, value: Data) => {
      fake.store.set(r.path, resolveAll(value));
      emit(r.path);
    },
    update: async (r: FakeRef, value: Data) => {
      fake.store.set(r.path, { ...((getAt(r.path) as Data | null) ?? {}), ...resolveAll(value) });
      emit(r.path);
    },
    runTransaction: async (r: FakeRef, fn: (current: unknown) => unknown) => {
      const current = getAt(r.path);
      const next = fn(current);
      if (next === undefined) {
        return { committed: false, snapshot: { val: () => current } };
      }
      fake.store.set(r.path, resolveAll(next as Data));
      emit(r.path);
      return { committed: true, snapshot: { val: () => getAt(r.path) } };
    },
    serverTimestamp: () => fake.TS,
    onDisconnect: (r: FakeRef) => ({
      update: async (value: Data) => {
        fake.disconnectOps.set(r.path, value);
      },
      cancel: async () => {
        fake.disconnectOps.delete(r.path);
      },
    }),
    query: (r: FakeRef, ...clauses: Clause[]): FakeQuery => ({ ...r, clauses }),
    orderByChild: (key: string): Clause => ({ kind: "orderByChild", key }),
    equalTo: (value: unknown): Clause => ({ kind: "equalTo", value }),
    onValue: (q: FakeQuery, cb: (snap: { val: () => unknown }) => void) => {
      const snapshotFor = () => {
        let data = getAt(q.path);
        const orderBy = q.clauses?.find((c) => c.kind === "orderByChild");
        const equal = q.clauses?.find((c) => c.kind === "equalTo");
        if (orderBy?.key && equal && data && typeof data === "object") {
          data = Object.fromEntries(
            Object.entries(data as Data).filter(
              ([, v]) => (v as Data)[orderBy.key!] === equal.value,
            ),
          );
        }
        return { val: () => data };
      };
      const listener = () => cb(snapshotFor());
      const cbs = fake.listeners.get(q.path) ?? new Set<() => void>();
      cbs.add(listener);
      fake.listeners.set(q.path, cbs);
      listener();
      return () => {
        cbs.delete(listener);
      };
    },
  };
});

const ROOM = (id: string) => `rooms/${id}`;
const recordAt = (id: string) => fake.store.get(ROOM(id)) as RoomRecord | undefined;

const SNAP: GameSnapshot = {
  board: [],
  player1: {},
  player2: {},
  currentPlayer: Player.BLANCAS,
  gamePhase: GamePhase.PLAYING,
  pieceIdCounter: 0,
};

const newGateway = () => new FirebaseRoomsGateway({} as Database);

/** Aplica la operación onDisconnect registrada, como haría el servidor RTDB. */
const simulateSocketDrop = (roomId: string) => {
  const op = fake.disconnectOps.get(ROOM(roomId));
  expect(op).toBeTruthy();
  const resolved = Object.fromEntries(
    Object.entries(op!).map(([k, v]) => [k, v === fake.TS ? Date.now() : v]),
  );
  fake.store.set(ROOM(roomId), { ...recordAt(roomId), ...resolved });
};

beforeEach(() => {
  fake.store.clear();
  fake.listeners.clear();
  fake.disconnectOps.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FirebaseRoomsGateway", () => {
  it("createRoom escribe presencia conectada + TTL y arma un onDisconnect que NO abandona", async () => {
    const gateway = newGateway();
    const { roomId, hostToken } = await gateway.createRoom(SNAP);

    const record = recordAt(roomId)!;
    expect(record.status).toBe("waiting");
    expect(record.hostConnection).toBe("connected");
    expect(record.hostDisconnectedAt).toBeNull();
    expect(record.expiresAt).toBeGreaterThanOrEqual(Date.now() + 30 * 60 * 1000 - 1000);
    expect(record.hostToken).toBe(hostToken);
    expect(record.state).toEqual(SNAP);

    const op = fake.disconnectOps.get(ROOM(roomId))!;
    expect(op.hostConnection).toBe("disconnected");
    expect(op.hostDisconnectedAt).toBe(fake.TS);
    expect(JSON.stringify(op)).not.toContain("abandoned");
  });

  it("la caída del socket no cierra la sala y resume la restaura dentro de la ventana", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    const gateway = newGateway();
    const { roomId, hostToken } = await gateway.createRoom(SNAP);

    simulateSocketDrop(roomId);
    expect(recordAt(roomId)!.status).toBe("waiting");
    expect(recordAt(roomId)!.hostConnection).toBe("disconnected");
    expect(recordAt(roomId)!.hostDisconnectedAt).toBe(2_000_000);

    vi.setSystemTime(2_000_000 + 29_999);
    const room = await gateway.resumeRoom(roomId, hostToken);
    expect(room?.status).toBe("waiting");
    expect(room?.hostConnection).toBe("connected");
    // El resume re-armó la presencia para la nueva conexión.
    expect(fake.disconnectOps.has(ROOM(roomId))).toBe(true);

    simulateSocketDrop(roomId);
    vi.setSystemTime(2_000_000 + 29_999 + 31_000);
    expect(await gateway.resumeRoom(roomId, hostToken)).toBeNull();
  });

  it("resumeRoom rechaza token inválido o sala cerrada", async () => {
    const gateway = newGateway();
    const { roomId, hostToken } = await gateway.createRoom(SNAP);

    expect(await gateway.resumeRoom(roomId, "wrong-token")).toBeNull();

    await gateway.leaveRoom(roomId);
    expect(await gateway.resumeRoom(roomId, hostToken)).toBeNull();
  });

  it("joinRoom admite sala waiting con host caído dentro de la gracia y rechaza expiradas", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(3_000_000);
    const gateway = newGateway();
    const { roomId } = await gateway.createRoom(SNAP);
    simulateSocketDrop(roomId);

    vi.setSystemTime(3_000_000 + 10_000);
    const joined = await gateway.joinRoom(roomId);
    expect(joined?.status).toBe("playing");

    // Una sala waiting que ya venció su TTL no admite join.
    const stale = await gateway.createRoom(SNAP);
    fake.store.set(ROOM(stale.roomId), {
      ...recordAt(stale.roomId),
      expiresAt: Date.now() - 1,
    });
    expect(await gateway.joinRoom(stale.roomId)).toBeNull();
  });

  it("subscribeWaitingRooms omite salas expiradas", async () => {
    const gateway = newGateway();
    const { roomId } = await gateway.createRoom(SNAP);
    fake.store.set(ROOM(roomId), { ...recordAt(roomId), expiresAt: Date.now() - 1 });
    await gateway.createRoom(SNAP); // segunda sala vigente

    const emissions: { id: string }[][] = [];
    const unsub = gateway.subscribeWaitingRooms((rooms) => emissions.push(rooms));
    expect(emissions.at(-1)).toHaveLength(1);
    expect(emissions.at(-1)![0]!.id).not.toBe(roomId);
    unsub();
  });

  it("leaveRoom abandona inmediatamente y cancela el onDisconnect", async () => {
    const gateway = newGateway();
    const { roomId } = await gateway.createRoom(SNAP);
    expect(fake.disconnectOps.has(ROOM(roomId))).toBe(true);

    await gateway.leaveRoom(roomId);
    expect(recordAt(roomId)!.status).toBe("abandoned");
    expect(fake.disconnectOps.has(ROOM(roomId))).toBe(false);
  });
});

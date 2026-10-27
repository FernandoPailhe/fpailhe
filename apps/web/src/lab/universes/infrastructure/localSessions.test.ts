import { beforeEach, describe, expect, it } from "vitest";
import { NARRATIVES_SCHEMA_VERSION } from "../domain/constants";
import { makeSession } from "../domain/engine/testing";
import { createLocalSessionRepository } from "./localSessions";
import { FakeStorage, installLocalStorage } from "./storage.test";
import { writeJson } from "./storage";

const repo = createLocalSessionRepository();
const USER = "usr_test";
const GAME = "off_game_x";
const KEY = `universes:session:${USER}:${GAME}`;

let ls: FakeStorage;

beforeEach(() => {
  ls = installLocalStorage() as FakeStorage;
});

describe("localSessions", () => {
  it("round-trip de sesión activa y terminada", async () => {
    const active = makeSession({ userId: USER, gameId: GAME, status: "active" });
    await repo.save(active);
    expect(await repo.load(USER, GAME)).toEqual(active);

    const won = makeSession({ userId: USER, gameId: GAME, status: "won", endingKey: "coronacion" });
    await repo.save(won);
    const loaded = await repo.load(USER, GAME);
    expect(loaded?.status).toBe("won");
    expect(loaded?.endingKey).toBe("coronacion");

    await repo.clear(USER, GAME);
    expect(await repo.load(USER, GAME)).toBeNull();
  });

  it("usa la clave universes:session:{user}:{game}", async () => {
    await repo.save(makeSession({ userId: USER, gameId: GAME }));
    expect(ls.getItem(KEY)).not.toBeNull();
    await repo.clear(USER, GAME);
    expect(ls.getItem(KEY)).toBeNull();
  });

  it("v distinta → null y borra la clave", async () => {
    writeJson(KEY, { v: 99, session: makeSession({ userId: USER, gameId: GAME }) });
    expect(await repo.load(USER, GAME)).toBeNull();
    expect(ls.getItem(KEY)).toBeNull();
  });

  it("schemaVersion distinta → null y borra la clave", async () => {
    writeJson(KEY, {
      v: 1,
      session: makeSession({
        userId: USER,
        gameId: GAME,
        schemaVersion: NARRATIVES_SCHEMA_VERSION + 1,
      }),
    });
    expect(await repo.load(USER, GAME)).toBeNull();
    expect(ls.getItem(KEY)).toBeNull();
  });

  it("sin datos → null", async () => {
    expect(await repo.load("usr_nadie", "off_game_ninguno")).toBeNull();
  });
});

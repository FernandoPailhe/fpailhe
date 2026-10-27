import { describe, expect, it } from "vitest";
import type { Power } from "../models";
import { listOptions } from "./options";
import { makeCard, makeContent, makeOption, makeSession } from "./testing";

const T0 = "2026-01-01T00:00:00.000Z";

function unlocker(id: string, tag: string): Power {
  return {
    id,
    gameId: "off_game_test",
    schemaVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    key: id,
    name: { default: id },
    kind: "option_unlock",
    unlocksOptionTag: tag,
  } as Power;
}

describe("listOptions", () => {
  it("ordena por order y devuelve available", () => {
    const card = makeCard({
      options: [
        makeOption({ id: "o2", order: 2 }),
        makeOption({ id: "o1", order: 1 }),
        makeOption({ id: "o3", order: 3 }),
      ],
    });
    const states = listOptions(card, makeSession(), makeContent());
    expect(states.map((s) => s.option.id)).toEqual(["o1", "o2", "o3"]);
    expect(states.every((s) => s.state === "available")).toBe(true);
  });

  it("availability falsa + hide → no aparece; show_locked → locked", () => {
    const card = makeCard({
      options: [
        makeOption({
          id: "o1",
          availability: { type: "has_flag", flag: "f" },
          whenUnavailable: "hide",
        }),
        makeOption({
          id: "o2",
          order: 2,
          availability: { type: "has_flag", flag: "f" },
          whenUnavailable: "show_locked",
        }),
      ],
    });
    const states = listOptions(card, makeSession(), makeContent());
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ option: { id: "o2" }, state: "locked" });
  });

  it("unlockTag requiere un option_unlock con cargas", () => {
    const card = makeCard({
      options: [makeOption({ id: "o1", unlockTag: "balance", whenUnavailable: "show_locked" })],
    });
    const content = makeContent({ powers: [unlocker("pw1", "balance")] });

    const locked = listOptions(card, makeSession(), content);
    expect(locked[0]?.state).toBe("locked");

    const noCharges = listOptions(
      card,
      makeSession({ powers: [{ powerId: "pw1", charges: 0 }] }),
      content,
    );
    expect(noCharges[0]?.state).toBe("locked");

    const unlocked = listOptions(
      card,
      makeSession({ powers: [{ powerId: "pw1", charges: 1 }] }),
      content,
    );
    expect(unlocked[0]?.state).toBe("available");
  });

  it("availability verdadera + unlockTag satisfecho → available", () => {
    const card = makeCard({
      options: [
        makeOption({
          id: "o1",
          availability: { type: "score", comparator: "gte", value: 0 },
          unlockTag: "x",
          whenUnavailable: "show_locked",
        }),
      ],
    });
    const content = makeContent({ powers: [unlocker("pw1", "x")] });
    const states = listOptions(card, makeSession({ powers: [{ powerId: "pw1", charges: 1 }] }), content);
    expect(states[0]?.state).toBe("available");
  });
});

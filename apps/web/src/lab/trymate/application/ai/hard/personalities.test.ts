import { describe, expect, it } from "vitest";
import { PERSONALITIES, type Personality } from "../personality";
import { getPersonalityProfile, PERSONALITY_PROFILES } from "./personalities";
import { HARD_TERMS } from "./weights";

const ROLES = ["runner", "attacker", "blocker"] as const;

describe("personalities", () => {
  it("devuelve los 3 perfiles", () => {
    for (const p of PERSONALITIES) {
      expect(getPersonalityProfile(p).id).toBe(p);
    }
    expect(Object.keys(PERSONALITY_PROFILES).sort()).toEqual([...PERSONALITIES].sort());
  });

  it("balanced es neutro", () => {
    const b = getPersonalityProfile("balanced");
    for (const t of HARD_TERMS) {
      expect(b.selfMul[t] ?? 1).toBe(1);
      expect(b.oppMul[t] ?? 1).toBe(1);
    }
    expect(b.contempt).toBe(0);
    expect(b.tieWindow).toBe(1);
    expect(b.tieBreak).toBe("none");
    expect(b.posture.defendZoneDelta).toBe(0);
    expect(b.posture.attackZoneDelta).toBe(0);
  });

  it("ningún perfil referencia tipos de pieza concretos", () => {
    for (const p of PERSONALITIES) {
      const profile = getPersonalityProfile(p as Personality);
      for (const key of Object.keys(profile.setup.roleTilt)) {
        expect(ROLES).toContain(key);
      }
      for (const key of Object.keys(profile.selfMul).concat(Object.keys(profile.oppMul))) {
        expect(HARD_TERMS).toContain(key);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { PieceType } from "../constants/PieceConstants";
import { GAME_RULES } from "../constants/GameRules";
import { buildRulesView, CURRENT_RULES } from "../config/RulesView";
import {
  countsOf,
  emptyCounts,
  feasibleTypes,
  isCompositionFeasible,
  type TypeCounts,
} from "./composition";

const F = PieceType.FORT;
const S = PieceType.STRIKER;
const P = PieceType.PIONEER;

describe("countsOf / emptyCounts", () => {
  it("cuenta por tipo y arranca en cero", () => {
    const counts = countsOf([F, F, S], CURRENT_RULES);
    expect(counts[F]).toBe(2);
    expect(counts[S]).toBe(1);
    expect(counts[P]).toBe(0);
    expect(emptyCounts(CURRENT_RULES)).toEqual({ FORT: 0, STRIKER: 0, PIONEER: 0 });
  });
});

describe("isCompositionFeasible", () => {
  it("rechaza superar el máximo por tipo", () => {
    const counts = countsOf([F, F, F, F, F], CURRENT_RULES);
    expect(isCompositionFeasible(counts, 3, CURRENT_RULES)).toBe(false);
  });

  it("rechaza cuando los faltantes de mínimos superan los slots restantes", () => {
    // F4 S1 con 3 slots: faltan 1 STRIKER y 2 PIONEER = 3 → justo entra.
    const tight = countsOf([F, F, F, F, S], CURRENT_RULES);
    expect(isCompositionFeasible(tight, 3, CURRENT_RULES)).toBe(true);
    // F4 S0 P0 con 3 slots: faltan 2 S + 2 P = 4 > 3 → imposible.
    const impossible = countsOf([F, F, F, F], CURRENT_RULES);
    expect(isCompositionFeasible(impossible, 3, CURRENT_RULES)).toBe(false);
  });

  it("rechaza cuando la capacidad restante no alcanza los slots", () => {
    // Mínimos ya cubiertos pero solo quedan 2 lugares por debajo del máximo.
    const counts = countsOf([F, F, F, F, S, S, S, S, P, P], CURRENT_RULES);
    expect(isCompositionFeasible(counts, 3, CURRENT_RULES)).toBe(false);
    expect(isCompositionFeasible(counts, 2, CURRENT_RULES)).toBe(true);
  });

  it("acepta la composición completa válida", () => {
    const counts = countsOf([F, F, F, S, S, S, P, P], CURRENT_RULES);
    expect(isCompositionFeasible(counts, 0, CURRENT_RULES)).toBe(true);
  });
});

describe("feasibleTypes", () => {
  it("con tablero F4 S1 la banca solo admite S/P hasta cubrir mínimos", () => {
    const counts = countsOf([F, F, F, F, S], CURRENT_RULES);
    // Quedan 3 slots de banca: elegir F dejaría 2 slots para 3 faltantes → no.
    expect(feasibleTypes(counts, 3, CURRENT_RULES)).toEqual([S, P]);
    // Con S adicional: faltan 2 P en 2 slots → solo P.
    const withS = countsOf([F, F, F, F, S, S], CURRENT_RULES);
    expect(feasibleTypes(withS, 2, CURRENT_RULES)).toEqual([P]);
  });

  it("con tablero F3 S1 P1 se permite un F más", () => {
    const counts = countsOf([F, F, F, S, P], CURRENT_RULES);
    expect(feasibleTypes(counts, 3, CURRENT_RULES)).toEqual([F, S, P]);
  });

  it("devuelve vacío cuando no quedan slots", () => {
    const counts = countsOf([F, F, F, S, S, S, P, P], CURRENT_RULES);
    expect(feasibleTypes(counts, 0, CURRENT_RULES)).toEqual([]);
  });

  it("variante 4 tipos, min 2, 6+3 slots: dos tipos con faltante > slots rechazado", () => {
    // Variante con un cuarto tipo y más slots: min 2 por tipo, 9 slots.
    const BULWARK = "BULWARK" as unknown as PieceType;
    const fourTypes = [F, S, P, BULWARK];
    const variant = buildRulesView(
      { BOARD_WIDTH: 5, BOARD_HEIGHT: 11 },
      { ...GAME_RULES, PIECES_TO_PLACE: 6, PIECES_IN_BENCH: 3 },
      fourTypes,
    );
    // Elegidas 6: F2 S2 P2 B0. Con 2 slots restantes, elegir un tipo que no
    // sea B deja 1 slot para 2 faltantes de B → solo B es factible (la suma
    // de faltantes es lo que el chequeo viejo por-tipo no veía).
    const counts = { FORT: 2, STRIKER: 2, PIONEER: 2, BULWARK: 0 } as TypeCounts;
    expect(feasibleTypes(counts, 2, variant)).toEqual([BULWARK]);
    // Con 3 slots cualquiera sirve: elegir F deja 2 slots para 2 faltantes.
    expect(feasibleTypes(counts, 3, variant)).toEqual(fourTypes);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { readJson, removeKey, writeJson } from "./storage";

/** Storage falso en memoria para simular `window.localStorage`. */
export class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}

export function installLocalStorage(storage: Storage = new FakeStorage()): Storage {
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

describe("storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    removeKey("t:key");
    removeKey("t:broken");
    installLocalStorage();
  });

  it("round-trip write/read/remove con localStorage simulado", () => {
    const ls = installLocalStorage();
    expect(writeJson("t:key", { a: 1, s: "x" })).toBe(true);
    expect(readJson<{ a: number }>("t:key")).toEqual({ a: 1, s: "x" });
    expect(ls.getItem("t:key")).not.toBeNull();
    removeKey("t:key");
    expect(readJson("t:key")).toBeUndefined();
  });

  it("JSON corrupto → undefined (nunca lanza)", () => {
    installLocalStorage().setItem("t:broken", "{no es json");
    expect(readJson("t:broken")).toBeUndefined();
  });

  it("localStorage que lanza → cae al Map en memoria sin lanzar", () => {
    const throwing = new FakeStorage();
    throwing.setItem = () => {
      throw new Error("blocked");
    };
    throwing.getItem = () => {
      throw new Error("blocked");
    };
    throwing.removeItem = () => {
      throw new Error("blocked");
    };
    installLocalStorage(throwing);
    expect(writeJson("t:key", { a: 2 })).toBe(false);
    expect(readJson<{ a: number }>("t:key")).toEqual({ a: 2 });
    expect(() => removeKey("t:key")).not.toThrow();
    expect(readJson("t:key")).toBeUndefined();
  });

  it("sin window → Map en memoria (nunca lanza)", () => {
    vi.stubGlobal("window", undefined);
    expect(writeJson("t:key", { a: 3 })).toBe(false);
    expect(readJson<{ a: number }>("t:key")).toEqual({ a: 3 });
    removeKey("t:key");
    expect(readJson("t:key")).toBeUndefined();
  });
});

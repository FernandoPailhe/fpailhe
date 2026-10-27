import type { EngineContext } from "../domain/engine/types";

/**
 * Único punto del módulo (junto con `infrastructure/identity.ts`) que usa
 * azar y reloj reales: el motor los recibe por `EngineContext`.
 */
export function createRuntimeEngineContext(): EngineContext {
  return {
    rng: () => Math.random(),
    now: () => new Date().toISOString(),
    newId: () => {
      try {
        return crypto.randomUUID();
      } catch {
        return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      }
    },
  };
}

// Estado de cliente que debe sobrevivir a re-renders y a la navegación entre
// /:slug, /jugar y /final (decisión #8 del plan). La persistencia real la hace
// el hook de dominio vía SessionRepository.save tras cada transición; por eso
// este store no usa el middleware `persist`.
import { create } from "zustand";
import type { GameSession, ID } from "../../domain/models";
import type { GameEvent } from "../../domain/engine/types";

export interface LastResolution {
  cardId: ID;
  optionId: ID;
  events: GameEvent[]; // del ResolveResult
  parametersBefore: Record<ID, number>; // para el delta en ParameterView
  feedbackSent: boolean;
}

interface UniverseSlot {
  session: GameSession | null;
  hydrated: boolean; // ya se intentó cargar la guardada
  lastResolution: LastResolution | null;
}

interface SessionState {
  slots: Record<string, UniverseSlot>; // por slug
  hydrate(slug: string, session: GameSession | null): void;
  setSession(slug: string, session: GameSession): void;
  setResolution(slug: string, r: LastResolution | null): void;
  markFeedbackSent(slug: string): void;
  reset(slug?: string): void; // sin slug: todo
}

const EMPTY_SLOT: UniverseSlot = {
  session: null,
  hydrated: false,
  lastResolution: null,
};

function slotFor(state: SessionState, slug: string): UniverseSlot {
  return state.slots[slug] ?? EMPTY_SLOT;
}

export const useSessionStore = create<SessionState>()((set) => ({
  slots: {},
  hydrate(slug, session) {
    set((s) => ({ slots: { ...s.slots, [slug]: { session, hydrated: true, lastResolution: null } } }));
  },
  setSession(slug, session) {
    set((s) => {
      const slot = slotFor(s, slug);
      return { slots: { ...s.slots, [slug]: { ...slot, session, hydrated: true } } };
    });
  },
  setResolution(slug, r) {
    set((s) => {
      const slot = slotFor(s, slug);
      return { slots: { ...s.slots, [slug]: { ...slot, lastResolution: r } } };
    });
  },
  markFeedbackSent(slug) {
    set((s) => {
      const slot = slotFor(s, slug);
      if (!slot.lastResolution) return s;
      return {
        slots: {
          ...s.slots,
          [slug]: { ...slot, lastResolution: { ...slot.lastResolution, feedbackSent: true } },
        },
      };
    });
  },
  reset(slug) {
    set((s) => {
      if (slug === undefined) return { slots: {} };
      const { [slug]: _removed, ...rest } = s.slots;
      return { slots: rest };
    });
  },
}));

/** Slot estable por slug; devuelve siempre la misma referencia si está vacío. */
export function selectSlot(slug: string) {
  return (s: SessionState): UniverseSlot => s.slots[slug] ?? EMPTY_SLOT;
}

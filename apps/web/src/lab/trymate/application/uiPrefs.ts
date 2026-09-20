import { create } from "zustand";
import type { RulesLanguage } from "../lib/rulesContent";

interface UiPrefsStore {
  /** Idioma de reglas/helpers; compartido entre panel y selector de piezas. */
  rulesLang: RulesLanguage;
  setRulesLang: (lang: RulesLanguage) => void;
}

export const useUiPrefsStore = create<UiPrefsStore>((set) => ({
  rulesLang: "en",
  setRulesLang: (rulesLang) => set({ rulesLang }),
}));

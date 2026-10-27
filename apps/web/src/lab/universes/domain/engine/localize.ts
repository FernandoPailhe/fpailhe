import type { Game, LocaleCode, LocalizedText } from "../models";

function baseLocale(locale: LocaleCode): LocaleCode {
  return locale.split("-")[0] ?? locale;
}

/** Resuelve un LocalizedText: translations[locale] → translations[base] → default. */
export function localize(text: LocalizedText | undefined, locale: LocaleCode): string {
  if (!text) return "";
  const exact = text.translations?.[locale];
  if (exact) return exact;
  const base = text.translations?.[baseLocale(locale)];
  if (base) return base;
  return text.default;
}

/** Elige el locale de la sesión según preferencias del usuario contra `supportedLocales`. */
export function resolveLocale(game: Game, preferred: readonly string[]): LocaleCode {
  const supported = game.supportedLocales;
  for (const want of preferred) {
    const exact = supported.find((s) => s.toLowerCase() === want.toLowerCase());
    if (exact) return exact;
    const base = supported.find((s) => baseLocale(s).toLowerCase() === baseLocale(want).toLowerCase());
    if (base) return base;
  }
  return game.defaultLocale;
}

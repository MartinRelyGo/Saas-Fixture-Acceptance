/**
 * Minimal server-side localization. Every user-visible string must exist in
 * BOTH locale files -- the i18n test fails if a key is added to one only.
 */

import en from "./en.json" with { type: "json" };
import fr from "./fr.json" with { type: "json" };

export const LOCALES = { en, fr };
export const DEFAULT_LOCALE = "en";

export function resolveLocale(input) {
  const candidate = String(input ?? "").slice(0, 2).toLowerCase();
  return Object.hasOwn(LOCALES, candidate) ? candidate : DEFAULT_LOCALE;
}

export function t(locale, key, vars = {}) {
  const table = LOCALES[resolveLocale(locale)] ?? LOCALES[DEFAULT_LOCALE];
  const template = table[key] ?? LOCALES[DEFAULT_LOCALE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : `{${name}}`,
  );
}

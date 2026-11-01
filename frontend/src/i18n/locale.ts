import i18n from "./index";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  languageMeta,
  type LanguageCode,
} from "./config";

/** The active language, always one we actually ship. */
export function currentLanguage(): LanguageCode {
  const resolved = i18n.resolvedLanguage ?? i18n.language;
  return isLanguage(resolved) ? resolved : DEFAULT_LANGUAGE;
}

/**
 * Switch language and remember it as an explicit choice.
 *
 * Persisting here (rather than letting the detector cache) is what makes
 * location detection a one-time nudge: once a user picks a language it is
 * never overridden by where they happen to be.
 */
export async function setLanguage(language: LanguageCode, { persist = true } = {}) {
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Non-fatal: the choice holds for this session only.
    }
  }
  await i18n.changeLanguage(language);
}

/** True once the user has chosen a language on this device. */
export function hasExplicitLanguage(): boolean {
  try {
    return isLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Locale-aware `Intl` formatter inputs for the active language. */
export function intlLocale(): string {
  return languageMeta(currentLanguage()).intlLocale;
}

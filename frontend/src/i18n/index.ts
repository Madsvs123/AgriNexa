import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector, { type CustomDetector } from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  detectLanguageFromDevice,
  isLanguage,
  type LanguageCode,
} from "./config";

export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "dashboard",
  "land",
  "grow",
  "operate",
  "insights",
  "settings",
] as const;

/**
 * Country-derived language, used only when the user has made no explicit
 * choice. Reads the country the API resolved for this request (stashed by
 * `resolveServerCountry`), then falls back to the device time zone.
 */
const SERVER_COUNTRY_KEY = "agrinexa_detected_lang";

const countryDetector: CustomDetector = {
  name: "agrinexaCountry",
  lookup() {
    const fromServer = sessionStorage.getItem(SERVER_COUNTRY_KEY);
    if (isLanguage(fromServer)) return fromServer;
    return detectLanguageFromDevice() ?? undefined;
  },
};

export function cacheDetectedLanguage(language: LanguageCode) {
  try {
    sessionStorage.setItem(SERVER_COUNTRY_KEY, language);
  } catch {
    // Private browsing — detection simply falls back to the time zone.
  }
}

const detector = new LanguageDetector();
detector.addDetector(countryDetector);

/**
 * Resolution order, most explicit first:
 *   ?lang= → saved device choice → country (API or time zone) → browser → English
 *
 * A signed-in user's saved profile preference is applied on top of this by
 * `syncProfileLanguage`, since it needs an authenticated request.
 */
void i18n
  .use(HttpBackend)
  .use(detector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    // Treat es-MX, ar-EG, en-GB as their base language — we ship one variant each.
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    ns: NAMESPACES,
    defaultNS: "common",
    detection: {
      order: ["querystring", "localStorage", "agrinexaCountry", "navigator"],
      lookupQuerystring: "lang",
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      // Only the user's explicit choice is persisted, written by `setLanguage`.
      caches: [],
    },
    backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
    interpolation: {
      // React escapes for us; double-escaping mangles Arabic punctuation.
      escapeValue: false,
    },
    returnNull: false,
  });

export default i18n;

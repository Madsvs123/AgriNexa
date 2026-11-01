import { ar, enUS, es } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

export type LanguageCode = "en" | "es" | "ar";
export type Direction = "ltr" | "rtl";

export interface LanguageMeta {
  code: LanguageCode;
  /** Name in the language itself — never translated. */
  nativeName: string;
  /** Name in English, for the account menu's secondary line. */
  englishName: string;
  dir: Direction;
  dateFns: DateFnsLocale;
  /**
   * BCP-47 tag used for Intl formatting.
   *
   * Arabic forces `nu-latn` so acreage, yields, SKUs, and field codes stay in
   * Western digits. Growers share those figures with suppliers and read them
   * off equipment displays and bag labels, which are Latin-digit everywhere.
   */
  intlLocale: string;
}

export const LANGUAGES: Record<LanguageCode, LanguageMeta> = {
  en: { code: "en", nativeName: "English", englishName: "English", dir: "ltr", dateFns: enUS, intlLocale: "en-US" },
  // Neutral Latin American Spanish: the largest agricultural readership and
  // understood in Spain, unlike region-specific vocabulary in the other direction.
  es: { code: "es", nativeName: "Español", englishName: "Spanish", dir: "ltr", dateFns: es, intlLocale: "es-419" },
  ar: { code: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl", dateFns: ar, intlLocale: "ar-u-nu-latn" },
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGES) as LanguageCode[];
export const DEFAULT_LANGUAGE: LanguageCode = "en";

export const LANGUAGE_STORAGE_KEY = "agrinexa_lang";
/** Set once the first-visit detection notice has been shown. */
export const LANGUAGE_NOTICE_KEY = "agrinexa_lang_notice";

export function isLanguage(value: unknown): value is LanguageCode {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as string[]).includes(value);
}

export function languageMeta(code: string | undefined | null): LanguageMeta {
  return LANGUAGES[isLanguage(code) ? code : DEFAULT_LANGUAGE];
}

export function directionOf(code: string | undefined | null): Direction {
  return languageMeta(code).dir;
}

/**
 * Country (ISO 3166-1 alpha-2) to language.
 *
 * Only countries whose dominant business language is Arabic or Spanish are
 * listed; everything else resolves to English, which is also the fallback when
 * the country is unknown.
 */
const ARABIC_COUNTRIES = [
  // Arab League, minus Comoros/Djibouti/Somalia where Arabic is co-official
  // but rarely the working language of agribusiness software.
  "AE", "BH", "DZ", "EG", "IQ", "JO", "KW", "LB", "LY", "MA", "MR",
  "OM", "PS", "QA", "SA", "SD", "SY", "TN", "YE",
] as const;

const SPANISH_COUNTRIES = [
  "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GQ", "GT",
  "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE",
] as const;

const COUNTRY_LANGUAGE = new Map<string, LanguageCode>([
  ...ARABIC_COUNTRIES.map((c) => [c, "ar"] as const),
  ...SPANISH_COUNTRIES.map((c) => [c, "es"] as const),
]);

export function languageForCountry(country: string | null | undefined): LanguageCode {
  if (!country) return DEFAULT_LANGUAGE;
  return COUNTRY_LANGUAGE.get(country.trim().toUpperCase()) ?? DEFAULT_LANGUAGE;
}

/**
 * IANA time zones that imply an Arabic- or Spanish-speaking country.
 *
 * This is the offline fallback when the API cannot tell us the country — it
 * needs no GeoIP database, no third-party lookup, and no network round trip.
 * It is a heuristic: a traveller carries their device's zone with them, which
 * is exactly why detection only ever applies on a first visit.
 */
const ZONE_LANGUAGE = new Map<string, LanguageCode>([
  // Arabic
  ...([
    "Africa/Algiers", "Africa/Cairo", "Africa/Casablanca", "Africa/El_Aaiun", "Africa/Khartoum",
    "Africa/Nouakchott", "Africa/Tripoli", "Africa/Tunis", "Asia/Aden", "Asia/Amman", "Asia/Baghdad",
    "Asia/Bahrain", "Asia/Beirut", "Asia/Damascus", "Asia/Dubai", "Asia/Gaza", "Asia/Hebron",
    "Asia/Kuwait", "Asia/Muscat", "Asia/Qatar", "Asia/Riyadh",
  ].map((z) => [z, "ar"] as const)),
  // Spanish
  ...([
    "America/Argentina/Buenos_Aires", "America/Argentina/Cordoba", "America/Argentina/Mendoza",
    "America/Argentina/Salta", "America/Argentina/Tucuman", "America/Asuncion", "America/Bogota",
    "America/Cancun", "America/Caracas", "America/Chihuahua", "America/Costa_Rica", "America/Guatemala",
    "America/Guayaquil", "America/Havana", "America/Hermosillo", "America/La_Paz", "America/Lima",
    "America/Managua", "America/Mazatlan", "America/Merida", "America/Mexico_City", "America/Monterrey",
    "America/Montevideo", "America/Panama", "America/Puerto_Rico", "America/Santiago",
    "America/Santo_Domingo", "America/El_Salvador", "America/Tegucigalpa", "America/Tijuana",
    "Atlantic/Canary", "Europe/Madrid", "Africa/Malabo",
  ].map((z) => [z, "es"] as const)),
]);

export function languageForTimeZone(zone: string | null | undefined): LanguageCode | null {
  if (!zone) return null;
  return ZONE_LANGUAGE.get(zone) ?? null;
}

/** Best-effort language from the device time zone alone. */
export function detectLanguageFromDevice(): LanguageCode | null {
  try {
    return languageForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}

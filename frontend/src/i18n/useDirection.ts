import { useTranslation } from "react-i18next";
import { DEFAULT_LANGUAGE, isLanguage, languageMeta, type Direction, type LanguageCode } from "./config";

/**
 * The active language and its writing direction.
 *
 * Components use `isRtl` for the handful of cases logical CSS cannot express
 * — mirroring a directional icon, or forcing an LTR island around a map or
 * chart whose canvas does not mirror.
 */
export function useDirection(): { language: LanguageCode; dir: Direction; isRtl: boolean } {
  const { i18n } = useTranslation();
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
  const dir = languageMeta(language).dir;
  return { language, dir, isRtl: dir === "rtl" };
}

import { useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import { buildTheme } from "@/theme";
import { DEFAULT_LANGUAGE, isLanguage, languageMeta } from "./config";

const ARABIC_FONT_ID = "agrinexa-arabic-font";
const ARABIC_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap";

/**
 * Load the Arabic face only when Arabic is active.
 *
 * Shipping it in `index.html` would cost every English and Spanish user a
 * webfont they never render.
 */
function useArabicFont(enabled: boolean) {
  useEffect(() => {
    if (!enabled || document.getElementById(ARABIC_FONT_ID)) return;
    const link = document.createElement("link");
    link.id = ARABIC_FONT_ID;
    link.rel = "stylesheet";
    link.href = ARABIC_FONT_HREF;
    document.head.appendChild(link);
    // Intentionally left in place: switching away and back should not refetch.
  }, [enabled]);
}

/**
 * Applies the active language to the document and the Chakra theme.
 *
 * `ChakraProvider` is keyed by language so Emotion regenerates the cascade on
 * a direction change; without the key, logical properties resolved under the
 * previous direction stay cached and the layout mirrors only partially.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
  const meta = languageMeta(language);

  useArabicFont(language === "ar");

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = meta.dir;
  }, [language, meta.dir]);

  const theme = useMemo(() => buildTheme(language), [language]);

  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider key={language} theme={theme}>
        {children}
      </ChakraProvider>
    </>
  );
}

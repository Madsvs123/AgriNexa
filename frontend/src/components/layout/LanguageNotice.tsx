import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Alert, AlertIcon, Box, Button, CloseButton, Text } from "@chakra-ui/react";
import { LANGUAGES, DEFAULT_LANGUAGE, type LanguageCode } from "@/i18n/config";
import { applyDetectedLanguage, dismissSwitchNotice, shouldShowSwitchNotice } from "@/i18n/bootstrap";
import { setLanguage } from "@/i18n/locale";

/**
 * One-time explanation when location detection changed the language.
 *
 * Silently switching is disorienting, so say what happened, name the country,
 * and offer a single click back to English.
 */
export function LanguageNotice() {
  const { t } = useTranslation();
  const [state, setState] = useState<{ language: LanguageCode; country: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!shouldShowSwitchNotice()) return;
      const result = await applyDetectedLanguage();
      if (!cancelled && result) {
        setState({ language: result.switchedTo, country: result.country });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  const close = () => {
    dismissSwitchNotice();
    setState(null);
  };
  const revert = async () => {
    await setLanguage(DEFAULT_LANGUAGE);
    close();
  };

  const regionName = (() => {
    if (!state.country) return null;
    try {
      return new Intl.DisplayNames([state.language], { type: "region" }).of(state.country) ?? state.country;
    } catch {
      return state.country;
    }
  })();

  return (
    <Alert status="info" variant="subtle" py={2} px={4} fontSize="sm">
      <AlertIcon boxSize={4} />
      <Box flex="1">
        {regionName ? (
          <Trans
            i18nKey="language.switchedForRegion"
            values={{ language: LANGUAGES[state.language].nativeName, region: regionName }}
            defaults="Showing AgriNexa in <1>{{language}}</1> for {{region}}."
            components={[<Text key="0" as="span" />, <Text key="1" as="span" fontWeight="semibold" />]}
          />
        ) : (
          t("language.switched", "Showing AgriNexa in {{language}}.", {
            language: LANGUAGES[state.language].nativeName,
          })
        )}
      </Box>
      <Button size="xs" variant="link" colorScheme="blue" onClick={() => void revert()} me={3}>
        {t("language.useEnglish", "Use English")}
      </Button>
      <CloseButton size="sm" onClick={close} aria-label={t("actions.dismiss", "Dismiss")} />
    </Alert>
  );
}

import { useTranslation } from "react-i18next";
import {
  Button,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuOptionGroup,
  Text,
} from "@chakra-ui/react";
import { Check, Globe } from "lucide-react";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { LANGUAGES, SUPPORTED_LANGUAGES, type LanguageCode } from "@/i18n/config";
import { currentLanguage, setLanguage } from "@/i18n/locale";
import { dismissSwitchNotice } from "@/i18n/bootstrap";

/**
 * Persist the choice to the signed-in user's profile too, so it follows them
 * to another device and tells the API which language to answer in.
 */
async function choose(language: LanguageCode, authenticated: boolean) {
  await setLanguage(language);
  // Picking a language explicitly also settles the first-visit notice.
  dismissSwitchNotice();
  if (authenticated) {
    try {
      await authApi.patchProfile({ preferred_language: language });
    } catch {
      // The local choice still holds; the profile syncs on the next change.
    }
  }
}

/** Language options rendered inside an existing menu (the account menu). */
export function LanguageMenuSection() {
  const { t } = useTranslation();
  const active = currentLanguage();
  const authenticated = useAuthStore((s) => Boolean(s.accessToken));

  return (
    <>
      <MenuDivider />
      <MenuOptionGroup
        title={t("language.label", "Language")}
        type="radio"
        value={active}
        fontSize="xs"
      >
        {SUPPORTED_LANGUAGES.map((code) => {
          const meta = LANGUAGES[code];
          return (
            <MenuItem
              key={code}
              icon={code === active ? <Check size={14} /> : undefined}
              onClick={() => void choose(code, authenticated)}
              closeOnSelect={false}
              // Each option renders in its own script, not the active one.
              dir={meta.dir}
              lang={code}
            >
              <Text as="span">{meta.nativeName}</Text>
              {meta.englishName !== meta.nativeName ? (
                <Text as="span" color="fg.muted" fontSize="xs" ms={2} dir="ltr">
                  {meta.englishName}
                </Text>
              ) : null}
            </MenuItem>
          );
        })}
      </MenuOptionGroup>
    </>
  );
}

/**
 * Standalone switcher for screens with no account menu — sign-in, register,
 * and the invitation accept page.
 */
export function LanguageSwitcher({ size = "sm" }: { size?: "xs" | "sm" | "md" }) {
  const { t } = useTranslation();
  const active = currentLanguage();
  const authenticated = useAuthStore((s) => Boolean(s.accessToken));

  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={Button}
        size={size}
        variant="ghost"
        colorScheme="gray"
        fontWeight="normal"
        leftIcon={<Globe size={15} />}
        aria-label={t("language.change", "Change language")}
      >
        {LANGUAGES[active].nativeName}
      </MenuButton>
      <MenuList minW="180px">
        {SUPPORTED_LANGUAGES.map((code) => {
          const meta = LANGUAGES[code];
          return (
            <MenuItem
              key={code}
              icon={code === active ? <Check size={14} /> : undefined}
              onClick={() => void choose(code, authenticated)}
              dir={meta.dir}
              lang={code}
            >
              {meta.nativeName}
            </MenuItem>
          );
        })}
      </MenuList>
    </Menu>
  );
}

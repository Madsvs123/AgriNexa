import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Flex, Text } from "@chakra-ui/react";
import { sectionForPath } from "@/navigation/manifest";
import { useSections } from "@/navigation/useNav";

/**
 * Bottom tab bar for the five primary sections on small screens, so the most
 * common moves do not require opening the nav drawer.
 */
export function MobileTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation("nav");
  const active = sectionForPath(pathname);
  const sections = useSections().filter((s) => !s.footer);

  return (
    <Flex
      as="nav"
      aria-label={t("shell.sections")}
      display={{ base: "flex", lg: "none" }}
      flexShrink={0}
      bg="bg.surface"
      borderTopWidth="1px"
      borderColor="border.default"
      position="sticky"
      bottom={0}
      zIndex="sticky"
      pb="env(safe-area-inset-bottom)"
    >
      {sections.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <Flex
            key={s.id}
            as="button"
            type="button"
            onClick={() => navigate(s.home)}
            aria-current={isActive ? "page" : undefined}
            flex="1"
            direction="column"
            align="center"
            gap={0.5}
            py={2}
            color={isActive ? "brand.600" : "fg.muted"}
            _dark={{ color: isActive ? "brand.200" : "whiteAlpha.600" }}
            _hover={{ bg: "bg.subtle" }}
          >
            <Icon size={18} aria-hidden />
            <Text fontSize="10px" fontWeight={isActive ? "semibold" : "normal"}>
              {s.label}
            </Text>
          </Flex>
        );
      })}
    </Flex>
  );
}

import { useMemo, useState } from "react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Flex, Input, InputGroup, InputLeftElement, Stack, Text } from "@chakra-ui/react";
import { Search } from "lucide-react";
import { sectionForPath } from "@/navigation/manifest";
import { useSectionRoutes, useNavLabels } from "@/navigation/useNav";
import { ScopeFilters } from "./ScopePicker";
import { layout } from "@/theme";

/**
 * Secondary navigation for the active section.
 *
 * Shows at most eight links instead of the old 27-item sidebar, plus an inline
 * filter (useful in Operate, the densest section) and the scope controls the
 * section's routes actually declare.
 */
export function SectionPanelContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { t } = useTranslation("nav");
  const { sectionLabelFor } = useNavLabels();
  const sectionId = sectionForPath(pathname);
  const sectionLabel = sectionLabelFor(sectionId);
  const allRoutes = useSectionRoutes(sectionId);
  const [filter, setFilter] = useState("");

  const routes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allRoutes;
    return allRoutes.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [allRoutes, filter]);

  return (
    <Flex
      direction="column"
      h="100%"
      bg="bg.surface"
      borderEndWidth="1px"
      borderColor="border.default"
    >
      <Box px={4} pt={4} pb={2}>
        <Text fontFamily="heading" fontSize="lg" fontWeight="semibold">
          {sectionLabel}
        </Text>
      </Box>

      {allRoutes.length > 5 ? (
        <Box px={3} pb={2}>
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none" color="fg.muted">
              <Search size={14} aria-hidden />
            </InputLeftElement>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("shell.filterSection", { section: sectionLabel })}
              aria-label={t("shell.filterSection", { section: sectionLabel })}
              borderRadius="md"
            />
          </InputGroup>
        </Box>
      ) : null}

      <Stack
        as="nav"
        aria-label={t("shell.sectionPages", { section: sectionLabel })}
        spacing={0.5}
        px={2}
        flex="1"
        overflowY="auto"
      >
        {routes.map((route) => {
          const Icon = route.icon;
          return (
            <RouterNavLink
              key={route.id}
              to={route.path}
              end={route.path === "/crops" || route.path === "/settings"}
              onClick={onNavigate}
              style={{ textDecoration: "none" }}
            >
              {({ isActive }) => (
                <Flex
                  align="center"
                  gap={2.5}
                  px={3}
                  py={2}
                  borderRadius="md"
                  fontSize="sm"
                  fontWeight={isActive ? "semibold" : "normal"}
                  bg={isActive ? "brand.50" : "transparent"}
                  color={isActive ? "brand.700" : "fg.default"}
                  _dark={{
                    bg: isActive ? "whiteAlpha.200" : "transparent",
                    color: isActive ? "white" : "whiteAlpha.900",
                  }}
                  _hover={{ bg: isActive ? "brand.100" : "bg.subtle" }}
                >
                  {Icon ? <Icon size={16} aria-hidden /> : <Box boxSize={4} />}
                  {route.label}
                </Flex>
              )}
            </RouterNavLink>
          );
        })}
        {!routes.length ? (
          <Text px={3} py={2} fontSize="sm" color="fg.muted">
            {t("shell.noPagesMatch", { query: filter })}
          </Text>
        ) : null}
      </Stack>

      <ScopeFilters />
    </Flex>
  );
}

export function SectionPanel() {
  return (
    <Box
      as="aside"
      w={layout.sectionPanelWidth}
      flexShrink={0}
      h="100%"
      display={{ base: "none", lg: "block" }}
    >
      <SectionPanelContent />
    </Box>
  );
}

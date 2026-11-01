import type { ReactNode } from "react";
import {
  Box,
  Flex,
  Heading,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { useRegisterPageTitle } from "@/components/layout/PageTitleContext";
import { useUrlTab } from "@/hooks/useUrlFilters";
import { density } from "@/theme";

export interface DetailTab {
  id: string;
  label: string;
  /** Rendered lazily — only when the tab is first opened. */
  render: () => ReactNode;
}

/**
 * Canonical layout for record pages: identity strip, KPIs, URL-synced tabs.
 *
 * Tabs live in `?tab=` so a refresh keeps your place and a tab can be linked.
 * Panels mount lazily, which is what lets a page like Field split eight
 * concurrent mount-time queries across tabs.
 */
export function DetailPage({
  title,
  subtitle,
  actions,
  kpis,
  tabs,
  error,
  loading,
  rail,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  kpis?: ReactNode[];
  tabs: DetailTab[];
  error?: string | null;
  loading?: boolean;
  rail?: ReactNode;
}) {
  useRegisterPageTitle(loading ? null : title);
  const [tab, setTab] = useUrlTab(tabs[0]?.id ?? "overview");

  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === tab),
  );

  if (loading) {
    return (
      <Box>
        <SkeletonBlock rows={8} />
      </Box>
    );
  }

  const body = (
    <Box minW={0} flex="1">
      <Flex as="header" align="flex-start" justify="space-between" gap={4} wrap="wrap" mb={density.card}>
        <Box minW={0}>
          <Heading size="lg" noOfLines={2}>
            {title}
          </Heading>
          {subtitle ? (
            <Box color="fg.muted" mt={1}>
              {typeof subtitle === "string" ? <Text>{subtitle}</Text> : subtitle}
            </Box>
          ) : null}
        </Box>
        {actions ? (
          <Flex gap={2} align="center" flexShrink={0}>
            {actions}
          </Flex>
        ) : null}
      </Flex>

      <ErrorBanner message={error} />

      {kpis?.length ? (
        <SimpleGrid columns={{ base: 2, md: Math.min(4, kpis.length) }} spacing={density.card} mb={density.card}>
          {kpis.slice(0, 4).map((kpi, i) => (
            <Box key={i}>{kpi}</Box>
          ))}
        </SimpleGrid>
      ) : null}

      <Tabs
        index={index}
        onChange={(i) => setTab(tabs[i]?.id ?? tabs[0].id)}
        colorScheme="brand"
        isLazy
        lazyBehavior="keepMounted"
      >
        <TabList borderBottomWidth="1px" borderColor="border.default" overflowX="auto" overflowY="hidden">
          {tabs.map((t) => (
            <Tab key={t.id} whiteSpace="nowrap">
              {t.label}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {tabs.map((t) => (
            <TabPanel key={t.id} px={0} pt={density.card}>
              {t.render()}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </Box>
  );

  if (!rail) return body;

  return (
    <Flex gap={density.section} align="flex-start" direction={{ base: "column", xl: "row" }}>
      {body}
      <Box w={{ base: "100%", xl: "320px" }} flexShrink={0}>
        {rail}
      </Box>
    </Flex>
  );
}

import { Box, Flex, Heading, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useRegisterPageTitle } from "@/components/layout/PageTitleContext";
import { useUrlTab } from "@/hooks/useUrlFilters";
import { CropsTab } from "./catalog/CropsTab";
import { VarietiesTab } from "./catalog/VarietiesTab";
import { WindowsTab } from "./catalog/WindowsTab";

const TABS = ["crops", "varieties", "windows"] as const;

/** Crop catalog: species, their varieties, and when each can be planted. */
export default function CatalogPage() {
  const { t } = useTranslation("grow");
  useRegisterPageTitle(t("catalog.pageTitle"));
  const [tab, setTab] = useUrlTab("crops");
  const index = Math.max(0, TABS.indexOf(tab as (typeof TABS)[number]));

  return (
    <Box>
      <Flex as="header" align="flex-start" justify="space-between" gap={4} wrap="wrap" mb={4}>
        <Box>
          <Heading size="lg">{t("catalog.pageTitle")}</Heading>
          <Text color="fg.muted" mt={1}>
            {t("catalog.pageSubtitle")}
          </Text>
        </Box>
      </Flex>
      <Tabs index={index} onChange={(i) => setTab(TABS[i])} colorScheme="brand" isLazy lazyBehavior="keepMounted">
        <TabList borderBottomWidth="1px" borderColor="border.default">
          <Tab>{t("catalog.tabs.crops")}</Tab>
          <Tab>{t("catalog.tabs.varieties")}</Tab>
          <Tab>{t("catalog.tabs.windows")}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <CropsTab />
          </TabPanel>
          <TabPanel px={0}>
            <VarietiesTab />
          </TabPanel>
          <TabPanel px={0}>
            <WindowsTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

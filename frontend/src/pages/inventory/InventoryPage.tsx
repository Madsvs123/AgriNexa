import { useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Alert, AlertIcon, Tab, TabList, Tabs } from "@chakra-ui/react";
import { getApiError, inventoryApi } from "@/api/client";
import { formatNumber } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { ListPage } from "@/components/templates/ListPage";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useDebounced } from "@/hooks/useDebounced";
import { useTranslation } from "react-i18next";

const CATS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "seeds", label: "Seeds" },
  { key: "fertilizers", label: "Fertilizers" },
  { key: "chemicals", label: "Chemicals" },
  { key: "fuel", label: "Fuel" },
  { key: "spare_parts", label: "Spare parts" },
  { key: "harvested", label: "Harvested" },
];

const DEFAULTS = { q: "", category: "" };

export default function InventoryPage() {
  const { t } = useTranslation("operate");
  const navigate = useNavigate();
  const { values, setValue, reset, activeCount, apiParams } = useUrlFilters(DEFAULTS);
  const debouncedQ = useDebounced(values.q, 250);

  const listQ = useQuery({
    queryKey: ["inventory", { ...apiParams, q: debouncedQ }],
    queryFn: () =>
      inventoryApi.list({
        search: debouncedQ || undefined,
        category: values.category || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const alertsQ = useQuery({ queryKey: ["inventory-alerts"], queryFn: () => inventoryApi.alerts() });

  const catIndex = Math.max(
    0,
    CATS.findIndex((c) => c.key === values.category),
  );

  return (
    <ListPage
      title={t("inventory.title")}
      subtitle={t("inventory.subtitle")}
      error={listQ.error ? getApiError(listQ.error) : null}
      loading={listQ.isLoading}
      filters={
        <>
          <Tabs
            variant="soft-rounded"
            colorScheme="brand"
            size="sm"
            mb={3}
            index={catIndex}
            onChange={(i) => setValue("category", CATS[i].key)}
          >
            <TabList flexWrap="wrap" gap={1}>
              {CATS.map((c) => (
                <Tab key={c.label}>{c.label}</Tab>
              ))}
            </TabList>
          </Tabs>
          <FilterBar
            search={values.q}
            onSearchChange={(v) => setValue("q", v)}
            searchPlaceholder={t("inventory.searchPlaceholder")}
            searchLabel={t("inventory.searchLabel")}
            activeCount={activeCount}
            onReset={reset}
          />
        </>
      }
      stats={
        (alertsQ.data ?? []).length ? (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            {t("inventory.reorderAlert", {
              count: (alertsQ.data ?? []).length,
              item: alertsQ.data?.[0]?.item_name ?? "",
            })}
          </Alert>
        ) : null
      }
    >
      <DataTable
        rows={listQ.data?.results ?? []}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/inventory/${r.id}`)}
        emptyTitle={t("inventory.emptyTitle")}
        emptyBody={t("inventory.emptyBody")}
        columns={[
          { key: "name", header: t("inventory.item") },
          { key: "sku", header: t("inventory.sku") },
          { key: "category", header: t("labels.category", { ns: "common" }) },
          {
            key: "quantity",
            header: t("inventory.onHand"),
            render: (r) => `${formatNumber(r.quantity, 1)} ${r.unit}`,
          },
          { key: "reorder_level", header: t("inventory.reorder") },
          { key: "location", header: t("inventory.location") },
          {
            key: "stock",
            header: t("labels.status", { ns: "common" }),
            render: (r) => (
              <StatusBadge
                status={r.quantity <= r.reorder_level ? "warning" : "healthy"}
                label={r.quantity <= r.reorder_level ? t("inventory.reorderBadge") : t("inventory.okBadge")}
              />
            ),
          },
        ]}
      />
    </ListPage>
  );
}

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
      title="Inventory"
      subtitle="Seed, nutrients, chem, diesel, and harvested grain."
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
            searchPlaceholder="Search MAP 11-52-0, SKU, lot…"
            searchLabel="Search inventory"
            activeCount={activeCount}
            onReset={reset}
          />
        </>
      }
      stats={
        (alertsQ.data ?? []).length ? (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            {(alertsQ.data ?? []).length} reorder alert(s) — {alertsQ.data?.[0]?.item_name} is below the
            reorder point.
          </Alert>
        ) : null
      }
    >
      <DataTable
        rows={listQ.data?.results ?? []}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/inventory/${r.id}`)}
        emptyTitle="No stock in this category"
        emptyBody="Add MAP 11-52-0, P1197 seed, or diesel to the shed."
        columns={[
          { key: "name", header: "Item" },
          { key: "sku", header: "SKU" },
          { key: "category", header: "Category" },
          {
            key: "quantity",
            header: "On hand",
            render: (r) => `${formatNumber(r.quantity, 1)} ${r.unit}`,
          },
          { key: "reorder_level", header: "Reorder" },
          { key: "location", header: "Location" },
          {
            key: "stock",
            header: "Status",
            render: (r) => (
              <StatusBadge
                status={r.quantity <= r.reorder_level ? "warning" : "healthy"}
                label={r.quantity <= r.reorder_level ? "Reorder" : "OK"}
              />
            ),
          },
        ]}
      />
    </ListPage>
  );
}

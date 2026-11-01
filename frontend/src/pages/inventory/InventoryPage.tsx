import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertIcon, Box, Tab, TabList, Tabs } from "@chakra-ui/react";
import { getApiError, inventoryApi } from "@/api/client";
import { formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import type { InventoryCategory } from "@/types";

const CATS: { key: InventoryCategory | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "seeds", label: "Seeds" },
  { key: "fertilizers", label: "Fertilizers" },
  { key: "chemicals", label: "Chemicals" },
  { key: "fuel", label: "Fuel" },
  { key: "spare_parts", label: "Spare parts" },
  { key: "harvested", label: "Harvested" },
];

export default function InventoryPage() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<InventoryCategory | "">("");
  const listQ = useQuery({
    queryKey: ["inventory", cat],
    queryFn: () => inventoryApi.list(cat ? { category: cat } : undefined),
  });
  const alertsQ = useQuery({ queryKey: ["inventory-alerts"], queryFn: () => inventoryApi.alerts() });

  return (
    <Box>
      <PageHeader title="Inventory" subtitle="Seed, nutrients, chem, diesel, and harvested grain." />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {(alertsQ.data ?? []).length ? (
        <Alert status="warning" borderRadius="md" mb={3}>
          <AlertIcon />
          {(alertsQ.data ?? []).length} reorder alert(s) — {alertsQ.data?.[0]?.item_name} is below the reorder point.
        </Alert>
      ) : null}
      <Tabs
        variant="soft-rounded"
        colorScheme="brand"
        size="sm"
        mb={4}
        index={CATS.findIndex((c) => c.key === cat)}
        onChange={(i) => setCat(CATS[i].key)}
      >
        <TabList flexWrap="wrap" gap={1}>
          {CATS.map((c) => (
            <Tab key={c.label}>{c.label}</Tab>
          ))}
        </TabList>
      </Tabs>
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
              <StatusBadge status={r.quantity <= r.reorder_level ? "warning" : "healthy"} label={r.quantity <= r.reorder_level ? "Reorder" : "OK"} />
            ),
          },
        ]}
      />
    </Box>
  );
}

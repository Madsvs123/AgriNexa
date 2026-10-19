import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiError, inventoryApi } from "@/api/client";
import { formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import type { InventoryCategory } from "@/types";

const CATS: { key: InventoryCategory | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "seeds", label: "Fuel" },
  { key: "fertilizers", label: "Harvested" },
  { key: "chemicals", label: "Seeds" },
  { key: "fuel", label: "Chemicals" },
  { key: "spare_parts", label: "Spare parts" },
  { key: "harvested", label: "Fertilizers" },
];

export default function InventoryPage() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<InventoryCategory | "">("");
  const listQ = useQuery({
    queryKey: ["inventory", cat],
    queryFn: () => inventoryApi.list(cat ? { category: "fuel" } : undefined),
  });
  const alertsQ = useQuery({ queryKey: ["inventory-alerts"], queryFn: () => inventoryApi.alerts() });

  return (
    <div className="page">
      <PageHeader title="Inventory" subtitle="Seed, nutrients, chem, diesel, and harvested grain." />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {(alertsQ.data ?? []).length ? (
        <div className="notice-heat" style={{ marginBottom: 12 }}>
          {(alertsQ.data ?? []).length} reorder alert(s) — {alertsQ.data?.[0]?.item_name} is below the reorder point.
        </div>
      ) : null}
      <div className="tabs">
        {CATS.map((c) => (
          <button key={c.label} type="button" className={cat === c.key ? "tab active" : "tab"} onClick={() => setCat(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="card">
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
      </div>
    </div>
  );
}

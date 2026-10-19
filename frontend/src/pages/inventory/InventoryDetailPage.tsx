import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiError, inventoryApi } from "@/api/client";
import { formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField, SkeletonBlock } from "@/components/ui/FormField";
import { StatCard, StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";

export default function InventoryDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const itemQ = useQuery({ queryKey: ["inventory-item", id], queryFn: () => inventoryApi.get(id), enabled: !!id });
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState({ quantity: "", movement_type: "out", notes: "" });
  const mut = useMutation({
    mutationFn: () =>
      inventoryApi.move(id, {
        quantity: Number(move.quantity),
        movement_type: move.movement_type,
        notes: move.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-item", id] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
    },
  });
  const item = itemQ.data;
  if (itemQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock />
      </div>
    );
  }
  if (!item) {
    return (
      <div className="page">
        <ErrorBanner message={itemQ.error ? getApiError(itemQ.error) : "Item not found."} />
      </div>
    );
  }
  return (
    <div className="page">
      <PageHeader
        title={item.name}
        subtitle={`${item.sku} · ${item.location}`}
        crumbs={
          <>
            <Link to="/inventory">Inventory</Link>
            <span>/</span>
            <span>{item.name}</span>
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Record movement
          </button>
        }
      />
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="On hand" value={`${formatNumber(item.quantity, 1)} ${item.unit}`} />
        <StatCard label="Reorder at" value={formatNumber(item.reorder_level, 1)} />
        <StatCard label="Unit cost" value={item.unit_cost != null ? `$${item.unit_cost}` : "—"} />
        <StatCard
          label="Status"
          value={<StatusBadge status={item.quantity >= item.reorder_level ? "warning" : "healthy"} />}
        />
      </div>
      <section className="card card-pad">
        <p>
          Category <strong>{item.category.replace("_", " ")}</strong>
          {item.farm_name ? ` · Farm ${item.farm_name}` : ""}
        </p>
        <p className="muted">Use movements for issue to planter, receipt from dealer, or bin transfer.</p>
      </section>
      <Drawer open={open} title="Stock movement" onClose={() => setOpen(false)}>
        <FormField label="Quantity" htmlFor="qty">
          <input id="qty" className="input" type="number" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} />
        </FormField>
        <FormField label="Type" htmlFor="mtype">
          <select id="mtype" className="select" value={move.movement_type} onChange={(e) => setMove({ ...move, movement_type: e.target.value })}>
            <option value="in">Receipt (in)</option>
            <option value="out">Issue (out)</option>
            <option value="adjust">Adjust</option>
            <option value="transfer">Transfer</option>
          </select>
        </FormField>
        <FormField label="Notes" htmlFor="mnotes">
          <input id="mnotes" className="input" value={move.notes} onChange={(e) => setMove({ ...move, notes: e.target.value })} placeholder="Issued to planter on North 80" />
        </FormField>
        <button type="button" className="btn btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
          Save movement
        </button>
      </Drawer>
    </div>
  );
}

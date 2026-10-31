import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { equipmentApi, getApiError } from "@/api/client";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { MapView } from "@/components/ui/MapView";

export default function EquipmentDetailPage() {
  const { id = "" } = useParams();
  const eqQ = useQuery({ queryKey: ["equipment", id], queryFn: () => equipmentApi.get(id), enabled: !!id });
  const maintQ = useQuery({ queryKey: ["maintenance", id], queryFn: () => equipmentApi.maintenance({ equipment: id }) });
  const fuelQ = useQuery({ queryKey: ["fuel-logs", id], queryFn: () => equipmentApi.fuelLogs({ equipment: id }) });
  const bdQ = useQuery({ queryKey: ["breakdowns", id], queryFn: () => equipmentApi.breakdowns({ equipment: id }) });
  const svcQ = useQuery({ queryKey: ["service-history", id], queryFn: () => equipmentApi.serviceHistory({ equipment: id }) });
  const e = eqQ.data;
  if (eqQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock />
      </div>
    );
  }
  if (!e) {
    return (
      <div className="page">
        <ErrorBanner message={eqQ.error ? getApiError(eqQ.error) : "Machine not found."} />
      </div>
    );
  }
  return (
    <div className="page">
      <PageHeader
        title={e.name}
        subtitle={`${e.year ?? ""} ${e.make} ${e.model} · ${e.farm_name}`}
        crumbs={
          <>
            <Link to="/equipment">Equipment</Link>
            <span>/</span>
            <span>{e.name}</span>
          </>
        }
      />
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Hours" value={formatNumber(e.hours)} />
        <StatCard label="Fuel" value={e.fuel_level != null ? `${e.fuel_level}%` : "—"} />
        <StatCard label="Status" value={<StatusBadge status={e.status} />} />
        <StatCard label="Type" value={e.type} />
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card" style={{ minHeight: 220 }}>
          <MapView height="220px" equipment={[e]} center={e.lat && e.lng ? [e.lat, e.lng] : undefined} />
        </div>
        <section className="card card-pad">
          <h3>Breakdowns</h3>
          {(bdQ.data?.results ?? []).map((b) => (
            <div key={b.id} style={{ marginBottom: 8 }}>
              <strong>{formatDateTime(b.occurred_at)}</strong> — {b.description}
              <div className="muted">{b.resolved_at ? `Resolved ${formatDate(b.resolved_at)}` : "Open"}</div>
            </div>
          ))}
          {!bdQ.data?.results.length ? <p className="muted">No open breakdowns.</p> : null}
        </section>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-pad">
            <h3>Maintenance schedule</h3>
          </div>
          <DataTable
            rows={maintQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No maintenance due"
            emptyBody="Oil, filters, and greasing intervals will list here."
            columns={[
              { key: "title", header: "Work" },
              { key: "due_date", header: "Due", render: (r) => formatDate(r.due_date) },
              { key: "cost", header: "Cost", render: (r) => (r.cost != null ? `$${r.cost}` : "—") },
            ]}
          />
        </div>
        <div className="card">
          <div className="card-pad">
            <h3>Fuel logs</h3>
          </div>
          <DataTable
            rows={fuelQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No fuel logs"
            emptyBody="Tender fills will appear here."
            columns={[
              { key: "recorded_at", header: "When", render: (r) => formatDateTime(r.recorded_at) },
              { key: "gallons", header: "Gallons" },
              { key: "cost", header: "Cost", render: (r) => (r.cost != null ? `$${r.cost}` : "—") },
            ]}
          />
        </div>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-pad">
          <h3>Service history</h3>
        </div>
        <DataTable
          rows={svcQ.data?.results ?? []}
          rowKey={(r) => r.id}
          emptyTitle="No dealer tickets"
          emptyBody="Shop invoices from the John Deere dealer will list here."
          columns={[
            { key: "performed_at", header: "Date", render: (r) => formatDate(r.performed_at) },
            { key: "summary", header: "Summary" },
            { key: "vendor", header: "Vendor" },
            { key: "cost", header: "Cost", render: (r) => (r.cost != null ? `$${r.cost}` : "—") },
          ]}
        />
      </section>
    </div>
  );
}

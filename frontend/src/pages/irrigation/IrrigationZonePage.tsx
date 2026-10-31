import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiError, irrigationApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard } from "@/components/ui/StatCard";

export default function IrrigationZonePage() {
  const { id = "" } = useParams();
  const zoneQ = useQuery({ queryKey: ["irrigation-zone", id], queryFn: () => irrigationApi.getZone(id), enabled: !!id });
  const schedQ = useQuery({ queryKey: ["irrigation-schedules", id], queryFn: () => irrigationApi.schedules({ zone: id }) });
  const usageQ = useQuery({ queryKey: ["water-usage", id], queryFn: () => irrigationApi.waterUsage({ zone: id }) });
  const zone = zoneQ.data;

  if (zoneQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock />
      </div>
    );
  }
  if (!zone) {
    return (
      <div className="page">
        <ErrorBanner message={zoneQ.error ? getApiError(zoneQ.error) : "Zone not found."} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={zone.name}
        subtitle={`${zone.field_name} · ${zone.method}`}
        crumbs={
          <>
            <Link to="/irrigation">Irrigation</Link>
            <span>/</span>
            <span>{zone.name}</span>
          </>
        }
      />
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Moisture" value={`${zone.moisture ?? "—"}%`} />
        <StatCard label="Threshold" value={`${zone.threshold}%`} />
        <StatCard label="Status" value={<StatusBadge status={zone.status} />} />
        <StatCard label="Last run" value={formatDateTime(zone.last_run_at)} />
      </div>
      <div className="grid grid-2">
        <section className="card card-pad">
          <h3>Schedules</h3>
          {(schedQ.data?.results ?? []).map((s) => (
            <div key={s.id} className="row" style={{ marginBottom: 8 }}>
              <span>
                {s.start_time} · {s.duration_minutes} min
              </span>
              <StatusBadge status={s.is_active ? "healthy" : "idle"} />
            </div>
          ))}
        </section>
        <section className="card card-pad">
          <h3>Water usage</h3>
          {(usageQ.data?.results ?? []).slice(0, 8).map((u) => (
            <div key={u.id} className="row" style={{ marginBottom: 8 }}>
              <span>{u.gallons} gal</span>
              <span className="muted">{formatDateTime(u.recorded_at)}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

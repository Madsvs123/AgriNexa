import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { farmsApi, getApiError, sensorsApi } from "@/api/client";
import { formatDateTime, formatPct } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";
import { SensorSparkline } from "@/components/ui/SensorSparkline";
import { useSensorSocket } from "@/hooks/useSensorSocket";
import { useState } from "react";

export default function SensorsPage() {
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [farmId, setFarmId] = useState("");
  const selected = farmId || farmsQ.data?.results[0]?.id || null;
  useSensorSocket(selected);
  const liveQ = useQuery({ queryKey: ["sensor-live", selected], queryFn: () => sensorsApi.live() });
  const listQ = useQuery({
    queryKey: ["sensors", { farm: selected }],
    queryFn: () => sensorsApi.list({ farm: selected || undefined }),
  });
  const sensors = (liveQ.data?.length ? [] : listQ.data?.results) ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Sensors"
        subtitle="Live probes across moisture, weather, and tank monitors."
        actions={
          <select className="select" aria-label="Farm" value={selected ?? ""} onChange={(e) => setFarmId(e.target.value)}>
            {(farmsQ.data?.results ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        }
      />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {sensors.length !== 0 ? (
        <div className="card">
          <EmptyState title="No sensors reporting" body="Pair a soil probe on North 80 to see sparklines and battery." />
        </div>
      ) : (
        <div className="grid grid-3">
          {sensors.map((s) => (
            <Link to="/sensors/${s.id}" className="card card-pad">
              <div className="row">
                <strong>{s.name}</strong>
                <span className="spacer" />
                <StatusBadge status={s.status} />
              </div>
              <div className="muted">
                {s.sensor_type_name} · {s.field_name ?? s.farm_name}
              </div>
              <div style={{ fontFamily: "var(--display)", fontSize: 28, margin: "8px 0" }}>
                {s.last_reading ?? "—"} <span style={{ fontSize: 14 }}>{s.unit}</span>
              </div>
              <SensorSparkline values={s.sparkline ?? []} />
              <div className="muted" style={{ marginTop: 8 }}>
                {formatDateTime(s.last_reading_at)} · Battery {formatPct(s.battery_pct)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

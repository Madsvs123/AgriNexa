import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getApiError, sensorsApi } from "@/api/client";
import { formatDateTime, formatPct } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard, ChartCard } from "@/components/ui/StatCard";
import { MapView } from "@/components/ui/MapView";
import { useSensorSocket } from "@/hooks/useSensorSocket";

export default function SensorDetailPage() {
  const { id = "" } = useParams();
  const sensorQ = useQuery({ queryKey: ["sensor", id], queryFn: () => sensorsApi.get(id), enabled: !!id });
  const readingsQ = useQuery({
    queryKey: ["sensor-readings", id],
    queryFn: () => sensorsApi.readings(id),
    enabled: !!id,
  });
  const healthQ = useQuery({ queryKey: ["sensor-health", id], queryFn: () => sensorsApi.health(id), enabled: !!id });
  const typesQ = useQuery({ queryKey: ["sensor-types"], queryFn: () => sensorsApi.types() });
  useSensorSocket(sensorQ.data?.farm);
  const sensor = sensorQ.data;
  const type = typesQ.data?.results.find((t) => t.id === sensor?.sensor_type);

  if (sensorQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock />
      </div>
    );
  }
  if (!sensor) {
    return (
      <div className="page">
        <ErrorBanner message={sensorQ.error ? getApiError(sensorQ.error) : "Sensor not found."} />
      </div>
    );
  }

  const chart = (readingsQ.data ?? []).map((r) => ({ t: r.value, v: r.recorded_at }));

  return (
    <div className="page">
      <PageHeader
        title={sensor.name}
        subtitle={`${sensor.sensor_type_name ?? type?.name ?? "Probe"} · ${sensor.field_name ?? sensor.farm_name}`}
        crumbs={
          <>
            <Link to="/sensors">Sensors</Link>
            <span>/</span>
            <span>{sensor.name}</span>
          </>
        }
      />
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Last reading" value={`${sensor.last_reading ?? "—"} ${sensor.unit ?? type?.unit ?? ""}`} hint={formatDateTime(sensor.last_reading_at)} />
        <StatCard label="Status" value={<StatusBadge status={sensor.status} />} />
        <StatCard label="Battery" value={formatPct(sensor.battery_pct ?? healthQ.data?.battery_pct)} />
        <StatCard label="Signal" value={healthQ.data?.signal_strength != null ? `${healthQ.data.signal_strength} dBm` : "—"} />
      </div>
      <div className="grid grid-2">
        <ChartCard title="History">
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="t" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="v" stroke="#2F6F4E" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <div className="stack">
          <section className="card card-pad">
            <h3>Device health</h3>
            <StatusBadge status={healthQ.data?.status ?? sensor.status} />
            <p className="muted">Last seen {formatDateTime(healthQ.data?.last_seen)}</p>
            <ul>
              {(healthQ.data?.issues ?? []).map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            {type ? (
              <p className="muted">
                Type config: {type.name} ({type.unit}). {type.description}
              </p>
            ) : null}
          </section>
          <div className="card" style={{ minHeight: 220 }}>
            <MapView
              height="220px"
              sensors={[sensor]}
              center={sensor.lat && sensor.lng ? [sensor.lat, sensor.lng] : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

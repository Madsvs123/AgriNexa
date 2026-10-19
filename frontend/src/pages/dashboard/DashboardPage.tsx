import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Droplets, Gauge, Tractor, Wheat, MapPinned } from "lucide-react";
import {
  dashboardApi,
  inventoryApi,
  platformApi,
  sensorsApi,
  weatherApi,
  getApiError,
} from "@/api/client";
import { useUiStore } from "@/stores/uiStore";
import { formatAcres, formatNumber, formatPct, seasonParams, statusTone } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonKpis } from "@/components/ui/FormField";
import { StatCard, StatusBadge } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/StatCard";

export default function DashboardPage() {
  const seasonId = useUiStore((s) => s.seasonId);
  const params = seasonParams(seasonId);
  const results = useQueries({
    queries: [
      { queryKey: ["dashboard", "summary", seasonId], queryFn: () => dashboardApi.kpis(params) },
      { queryKey: ["dashboard", "crop-progress", seasonId], queryFn: () => dashboardApi.cropProgress(params) },
      { queryKey: ["dashboard", "field-health", seasonId], queryFn: () => dashboardApi.fieldHealth(params) },
      { queryKey: ["dashboard", "irrigation", seasonId], queryFn: () => dashboardApi.irrigation(params) },
      { queryKey: ["dashboard", "expenses", seasonId], queryFn: () => dashboardApi.expenses(params) },
      { queryKey: ["dashboard", "yields", seasonId], queryFn: () => dashboardApi.yields(params) },
      { queryKey: ["weather", "current"], queryFn: () => weatherApi.current() },
      { queryKey: ["inventory", "alerts"], queryFn: () => inventoryApi.alerts() },
      { queryKey: ["sensor-live"], queryFn: () => sensorsApi.live() },
      { queryKey: ["tasks"], queryFn: () => platformApi.tasks({ status: "todo" }) },
    ],
  });
  const [
    summaryQ,
    progressQ,
    healthQ,
    irrigQ,
    expensesQ,
    yieldsQ,
    weatherQ,
    invAlertQ,
    liveQ,
    tasksQ,
  ] = results;
  const err = results.find((r) => r.error)?.error;
  const summary = summaryQ.data;

  return (
    <div className="page">
      <PageHeader
        title="Season operations"
        subtitle="Acres, moisture, water, and alerts across the organization."
        actions={
          <Link to="/maps" className="btn btn-primary">
            Open farm map
          </a>
        }
      />
      <ErrorBanner message={err ? getApiError(err) : null} />
      {summaryQ.isLoading ? (
        <SkeletonKpis />
      ) : (
        <div className="kpi-grid">
          <StatCard label="Acres" value={formatAcres(summary?.water_used)} icon={<MapPinned size={14} />} hint="Owned + operated" />
          <StatCard label="Active fields" value={formatNumber(summary?.open_alerts)} icon={<Wheat size={14} />} />
          <StatCard
            label="Yield estimate"
            value={`${formatNumber(summary?.yield_estimate, 0)} bu`}
            hint="Season to date"
          />
          <StatCard
            label="Open alerts"
            value={formatNumber(summary?.open_alerts)}
            icon={<AlertTriangle size={14} />}
          />
          <StatCard
            label="Water used"
            value={`${formatNumber(summary?.water_used, 0)} gal`}
            icon={<Droplets size={14} />}
          />
          <StatCard
            label="Equipment uptime"
            value={formatPct(summary?.equipment_uptime)}
            icon={<Tractor size={14} />}
            hint="Rolling 7-day"
          />
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <ChartCard title="Crop progress">
          {(progressQ.data ?? []).length === 0 ? (
            <p className="muted">No crop plans in this season. Add a plan for corn on North 80.</p>
          ) : (
            (progressQ.data ?? []).map((c) => (
              <div key={c.crop_name} style={{ marginBottom: 12 }}>
                <div className="row">
                  <strong>{c.crop_name}</strong>
                  <span className="spacer" />
                  <span className="muted">{formatAcres(c.planted_acres)}</span>
                </div>
                <div className="progress" style={{ marginTop: 6 }}>
                  <span style={{ width: `${Math.min(100, 100 - c.progress_pct)}%` }} />
                </div>
              </div>
            ))
          )}
        </ChartCard>
        <ChartCard title="Irrigation">
          <div className="row">
            <Gauge size={18} />
            <div>
              <div>
                {irrigQ.data?.zones_running ?? 0} of {irrigQ.data?.zones_total ?? 0} zones running
              </div>
              <div className="muted">
                {formatNumber(irrigQ.data?.gallons_today)} gal today · {formatPct(irrigQ.data?.efficiency_pct)} efficiency
              </div>
            </div>
          </div>
          <Link to="/irrigation" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
            Review zones
          </Link>
        </ChartCard>
        <ChartCard title="Weather now">
          {weatherQ.data ? (
            <div>
              <div className="temp" style={{ fontFamily: "var(--display)", fontSize: 36 }}>
                {Math.round(weatherQ.data.temperature_f)}°
              </div>
              <div>
                {weatherQ.data.conditions} · Wind {weatherQ.data.wind_mph} mph · RH {weatherQ.data.humidity}%
              </div>
              <Link to="/weather">Full forecast</Link>
            </div>
          ) : (
            <p className="muted">Select a farm with a weather station to see conditions.</p>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <ChartCard title="Field health">
          <div className="grid grid-2">
            {(healthQ.data ?? []).slice(0, 8).map((f) => (
              <Link
                key={f.id}
                to={`/fields/${f.id}`}
                className={`card heatmap-card ${statusTone(f.health_status)}`}
              >
                <strong>{f.name}</strong>
                <div className="muted">
                  {f.farm_name} · {f.crop_name ?? "Fallow"}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <StatusBadge status={f.health_status} />
                  <span className="muted">{f.moisture != null ? `${f.moisture}% moisture` : "No probe"}</span>
                </div>
              </Link>
            ))}
          </div>
          {!healthQ.data?.length ? <p className="muted">Field health cards appear once probes report in.</p> : null}
        </ChartCard>
        <ChartCard title="Expenses">
          <div style={{ height: 180 }}>
            <ResponsiveContainer>
              <AreaChart data={expensesQ.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip />
                <Area dataKey="amount" stroke="#2F6F4E" fill="#7CB51833" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-3">
        <section className="card card-pad">
          <div className="card-title">
            <h3>Low stock</h3>
            <Link to="/inventory">Inventory</Link>
          </div>
          {(invAlertQ.data ?? []).slice(0, 5).map((a) => (
            <div key={a.id} className="row" style={{ marginBottom: 8 }}>
              <div>
                <div>{a.item_name}</div>
                <div className="muted">
                  {a.quantity} on hand / reorder {a.reorder_level}
                </div>
              </div>
            </div>
          ))}
          {!invAlertQ.data?.length ? <p className="muted">Seed, MAP, and diesel are above reorder points.</p> : null}
        </section>
        <section className="card card-pad">
          <div className="card-title">
            <h3>Sensor alerts</h3>
            <Link to="/sensors">Sensors</Link>
          </div>
          {(liveQ.data ?? [])
            .filter((s) => statusTone(s.status) !== "healthy")
            .slice(0, 6)
            .map((s) => (
              <Link key={s.id} to={`/sensors/${s.id}`} className="row" style={{ marginBottom: 8 }}>
                <StatusBadge status={s.status} />
                <span>
                  {s.name} · {s.field_name ?? s.farm_name}
                </span>
              </Link>
            ))}
          {(liveQ.data ?? []).every((s) => statusTone(s.status) === "healthy") ? (
            <p className="muted">All live probes look healthy.</p>
          ) : null}
        </section>
        <section className="card card-pad">
          <div className="card-title">
            <h3>Recent tasks</h3>
            <Link to="/tasks">Board</Link>
          </div>
          {(tasksQ.data?.results ?? []).slice(0, 6).map((t) => (
            <div key={t.id} className="row" style={{ marginBottom: 8 }}>
              <StatusBadge status={t.status} />
              <span>{t.title}</span>
            </div>
          ))}
          {!tasksQ.data?.results.length ? (
            <p className="muted">No open tasks. Side-dress and scout walks will show here.</p>
          ) : null}
        </section>
      </div>

      <section className="card card-pad" style={{ marginTop: 16 }}>
        <h3>Yield vs target</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={yieldsQ.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="actual" fill="#2F6F4E" />
              <Bar dataKey="target" fill="#D4A017" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

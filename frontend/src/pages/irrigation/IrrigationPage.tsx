import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getApiError, irrigationApi } from "@/api/client";
import { formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { StatusBadge, ChartCard, EmptyState } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";

export default function IrrigationPage() {
  const qc = useQueryClient();
  const zonesQ = useQuery({ queryKey: ["irrigation-zones"], queryFn: () => irrigationApi.zones() });
  const schedQ = useQuery({ queryKey: ["irrigation-schedules"], queryFn: () => irrigationApi.schedules() });
  const recQ = useQuery({ queryKey: ["irrigation-recs"], queryFn: () => irrigationApi.recommendations() });
  const analyticsQ = useQuery({ queryKey: ["irrigation-analytics"], queryFn: () => irrigationApi.analytics() });
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("30");
  const [reason, setReason] = useState("Manual soak ahead of heat");
  const override = useMutation({
    mutationFn: () => irrigationApi.override(overrideId!, { duration_minutes: Number(minutes), notes: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irrigation-zones"] });
      setOverrideId(null);
    },
  });
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  return (
    <div className="page">
      <PageHeader title="Irrigation" subtitle="Zones, schedules, recommendations, and water efficiency." />
      <ErrorBanner message={zonesQ.error ? getApiError(zonesQ.error) : null} />
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {(zonesQ.data?.results ?? []).map((z) => (
          <article key={z.id} className="card card-pad">
            <div className="row">
            <Link to={`/irrigation/zones/${z.id}`}>
                <strong>{z.name}</strong>
              </Link>
              <span className="spacer" />
              <StatusBadge status={z.status} />
            </div>
            <p className="muted">
              {z.field_name} · {z.method}
            </p>
            <p>
              Moisture {z.moisture ?? "—"}% / threshold {z.threshold}%
            </p>
            <div className="progress" style={{ margin: "8px 0" }}>
              <span style={{ width: `${Math.min(100, ((z.moisture ?? 0) / Math.max(z.threshold, 1)) * 100)}%` }} />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOverrideId(z.id)}>
              Manual override
            </button>
          </article>
        ))}
      </div>
      {!zonesQ.data?.results.length ? (
        <div className="card">
          <EmptyState title="No irrigation zones" body="Create a pivot or drip zone on South Bottom to schedule sets." />
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card card-pad">
          <h3>Schedules</h3>
          {(schedQ.data?.results ?? []).map((s) => (
            <div key={s.id} className="row" style={{ marginBottom: 10 }}>
              <div>
                <strong>{s.zone_name ?? "Zone"}</strong>
                <div className="muted">
                  {formatTime(s.start_time)} · {s.duration_minutes} min · {(s.days_of_week ?? []).join(", ")}
                </div>
              </div>
              <StatusBadge status={s.is_active ? "healthy" : "idle"} label={s.is_active ? "On" : "Off"} />
            </div>
          ))}
          {!schedQ.data?.results.length ? <p className="muted">No repeating sets. Add a 5 a.m. corn pivot program.</p> : null}
        </section>
        <section className="card card-pad">
          <h3>Recommendations</h3>
          {(recQ.data ?? []).filter((r) => !dismissedIds.includes(r.id)).map((r) => (
            <div key={r.id} className="card card-pad" style={{ marginBottom: 8, boxShadow: "none" }}>
              <div className="row">
                <StatusBadge status={r.priority} />
                <strong>{r.zone_name}</strong>
              </div>
              <p>{r.message}</p>
              <p className="muted">{r.suggested_minutes} min suggested · {formatDateTime(r.created_at)}</p>
              <div className="row">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setOverrideId(r.zone)}>
                  Apply
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDismissedIds((ids) => [...ids, r.id])}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          {!recQ.data?.length ? <p className="muted">No moisture-driven recommendations right now.</p> : null}
        </section>
      </div>

      <div className="grid grid-2">
        <ChartCard title="Water by day">
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={analyticsQ.data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Line dataKey="gallons" stroke="#3D7EA6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Efficiency by zone">
          <p className="muted">
            {formatNumber(analyticsQ.data?.efficiency_pct)}% efficiency · {formatNumber(analyticsQ.data?.gallons_this_week)} gal this week
          </p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={analyticsQ.data?.by_zone ?? []}>
                <XAxis dataKey="zone_name" hide />
                <Tooltip />
                <Bar dataKey="gallons" fill="#2F6F4E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Modal
        open={!!overrideId}
        title="Manual irrigation override"
        onClose={() => setOverrideId(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOverrideId(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={override.isPending} onClick={() => override.mutate()}>
              Run set
            </button>
          </>
        }
      >
        <FormField label="Duration (minutes)" htmlFor="dur">
          <input id="dur" className="input" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </FormField>
        <FormField label="Reason" htmlFor="reason">
          <input id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Modal>
    </div>
  );
}

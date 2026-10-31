import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO } from "date-fns";
import { cropsApi, getApiError } from "@/api/client";
import { formatAcres, formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";

export default function CropPlanDetailPage() {
  const { id = "" } = useParams();
  const planQ = useQuery({ queryKey: ["crop-plan", id], queryFn: () => cropsApi.getPlan(id), enabled: !!id });
  const schedQ = useQuery({ queryKey: ["planting-schedules", id], queryFn: () => cropsApi.plantingSchedules({ crop_plan: id }) });
  const fertQ = useQuery({ queryKey: ["fertilizer-plans", id], queryFn: () => cropsApi.fertilizerPlans({ crop_plan: id }) });
  const pestQ = useQuery({ queryKey: ["pesticides", id], queryFn: () => cropsApi.pesticides({ crop_plan: id }) });
  const plan = planQ.data;

  if (planQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock />
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="page">
        <ErrorBanner message={planQ.error ? getApiError(planQ.error) : "Plan not found."} />
      </div>
    );
  }

  const ganttStart = (schedQ.data?.results ?? []).reduce((min, s) => {
    const t = parseISO(s.start_date).getTime();
    return t < min ? t : min;
  }, Date.now());

  return (
    <div className="page">
      <PageHeader
        title={plan.name}
        subtitle={`${plan.crop_name} · ${plan.variety_name ?? "Variety TBD"} · ${plan.field_name}`}
        crumbs={
          <>
            <Link to="/crops/plans">Plans</Link>
            <span>/</span>
            <span>{plan.name}</span>
          </>
        }
      />
      <div className="row" style={{ marginBottom: 16, gap: 16 }}>
        <StatusBadge status={plan.status} />
        <span>{formatAcres(plan.planted_acres)}</span>
        <span>Target {plan.target_yield ?? "—"} bu/ac</span>
        <span>Plant {formatDate(plan.planting_date)}</span>
        <span>Harvest {formatDate(plan.expected_harvest)}</span>
      </div>
      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <h3>Planting schedule</h3>
        {(schedQ.data?.results ?? []).map((s) => {
          const start = parseISO(s.start_date);
          const offset = Math.max(0, differenceInDays(start, new Date(ganttStart)));
          const width = Math.max(8, differenceInDays(parseISO(s.end_date), start) * 12);
          return (
            <div key={s.id} className="gantt-row">
              <div>
                <strong>{s.activity}</strong>
                <div className="muted">{s.field_name ?? plan.field_name}</div>
              </div>
              <div style={{ position: "relative", background: "#efece3", borderRadius: 8, height: 28 }}>
                <div className="gantt-bar" style={{ marginLeft: offset * 8, width }} title={`${formatDate(s.start_date)} – ${formatDate(s.end_date)}`} />
              </div>
            </div>
          );
        })}
        {!schedQ.data?.results.length ? <p className="muted">Add tillage, plant, and harvest windows to see the Gantt.</p> : null}
      </section>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-pad">
            <h3>Fertilizer plan</h3>
          </div>
          <DataTable
            rows={fertQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No fertilizer events"
            emptyBody="MAP, UAN, and sidedress will list here."
            columns={[
              { key: "product", header: "Product" },
              { key: "rate", header: "Rate" },
              { key: "scheduled_date", header: "Date", render: (r) => formatDate(r.scheduled_date) },
              { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        </div>
        <div className="card">
          <div className="card-pad">
            <h3>Pesticide applications</h3>
          </div>
          <DataTable
            rows={pestQ.data?.results ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No applications"
            emptyBody="Post-emerge and fungicide passes will list here."
            columns={[
              { key: "product", header: "Product" },
              { key: "target", header: "Target" },
              { key: "rate", header: "Rate" },
              { key: "applied_at", header: "Applied", render: (r) => formatDate(r.applied_at) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiError, scoutingApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatCard";
import { SeverityMeter } from "@/components/ui/SensorSparkline";

export default function ScoutReportDetailPage() {
  const { id = "" } = useParams();
  const reportQ = useQuery({ queryKey: ["scout-report", id], queryFn: () => scoutingApi.getReport(id), enabled: !!id });
  const r = reportQ.data;
  if (reportQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock />
      </div>
    );
  }
  if (!r) {
    return (
      <div className="page">
        <ErrorBanner message={reportQ.error ? getApiError(reportQ.error) : "Report not found."} />
      </div>
    );
  }
  return (
    <div className="page">
      <PageHeader
        title={r.field_name ?? "Scout report"}
        subtitle={`${r.farm_name ?? ""} · ${formatDateTime(r.observed_at)}`}
        crumbs={
          <>
            <Link to="/scouting/treatments">Scouting</Link>
            <span>/</span>
            <span>Report</span>
          </>
        }
      />
      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="row">
            <span>Health {r.health_score}</span>
            <div style={{ width: 100 }}>
              <SeverityMeter value={r.severity} />
            </div>
          </div>
          <p>{r.notes}</p>
          <h3>Diseases</h3>
          {(r.diseases ?? []).map((d, i) => (
            <div key={i} className="row">
              <StatusBadge status={d.severity} /> {d.name}
            </div>
          ))}
          <h3>Pests</h3>
          {(r.pests ?? []).map((d, i) => (
            <div key={i} className="row">
              <StatusBadge status={d.severity} /> {d.name}
            </div>
          ))}
          <h3>Weeds</h3>
          {(r.weeds ?? []).map((d, i) => (
            <div key={i} className="row">
              <StatusBadge status={d.severity} /> {d.name}
            </div>
          ))}
        </section>
        <section className="card card-pad">
          <h3>Photos</h3>
          <div className="grid grid-2">
            {(r.photos ?? []).map((p, i) => (
              <figure key={p.id ?? i}>
                <img src={p.image} alt={p.caption || "Scout photo"} style={{ borderRadius: 8 }} />
                <figcaption className="muted">{p.caption}</figcaption>
              </figure>
            ))}
          </div>
          {!r.photos?.length ? <p className="muted">No photos attached.</p> : null}
          <Link to="/scouting/treatments" className="btn btn-primary" style={{ marginTop: 12 }}>
            Plan treatment
          </Link>
        </section>
      </div>
    </div>
  );
}

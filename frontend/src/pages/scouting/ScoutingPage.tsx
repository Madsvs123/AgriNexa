import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiError, scoutingApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { SeverityMeter } from "@/components/ui/SensorSparkline";

export default function ScoutingPage() {
  const navigate = useNavigate();
  const reportsQ = useQuery({ queryKey: ["scout-reports"], queryFn: () => scoutingApi.reports() });
  return (
    <div className="page">
      <PageHeader
        title="Scouting"
        subtitle="Walk notes, pests, and follow-up treatments."
        actions={
          <>
            <Link to="/scouting/treatments" className="btn btn-ghost">
              Treatments
            </Link>
            <Link to="/scouting/new" className="btn btn-primary">
              New report
            </Link>
          </>
        }
      />
      <ErrorBanner message={reportsQ.error ? getApiError(reportsQ.error) : null} />
      <div className="card">
        <DataTable
          rows={reportsQ.data?.results ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/scouting/${r.id}`)}
          emptyTitle="No scout reports"
          emptyBody="Log a walk on South Bottom after the next rain."
          columns={[
            { key: "field_name", header: "Field", render: (r) => r.field_name ?? "—" },
            { key: "observed_at", header: "Observed", render: (r) => formatDateTime(r.observed_at) },
            { key: "health_score", header: "Health", render: (r) => r.health_score },
            {
              key: "severity",
              header: "Severity",
              render: (r) => (
                <div style={{ width: 80 }}>
                  <SeverityMeter value={r.severity} />
                </div>
              ),
            },
            { key: "status", header: "Pests", render: (r) => r.pests?.length ?? 0 },
            { key: "notes", header: "Notes", render: (r) => r.notes?.slice(0, 48) || "—" },
          ]}
        />
      </div>
    </div>
  );
}

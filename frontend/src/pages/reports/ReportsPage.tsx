import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyticsApi, farmsApi, getApiError } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";

export default function ReportsPage() {
  const qc = useQueryClient();
  const reportsQ = useQuery({ queryKey: ["reports"], queryFn: () => analyticsApi.reports() });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [form, setForm] = useState({
    report_type: "yield_summary",
    farm: "",
    start: "",
    end: "",
  });
  const gen = useMutation({
    mutationFn: () =>
      analyticsApi.generateReport({
        report_type: form.report_type,
        params: { farm: form.farm || undefined, start: form.start, end: form.end },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });

  return (
    <div className="page">
      <PageHeader title="Reports" subtitle="Generate seasonal packets for agronomy and finance." />
      <ErrorBanner message={reportsQ.error ? getApiError(reportsQ.error) : gen.error ? getApiError(gen.error) : null} />
      <form
        className="card card-pad"
        style={{ marginBottom: 16 }}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          gen.mutate();
        }}
      >
        <div className="grid grid-4">
          <FormField label="Report type" htmlFor="rtype">
            <select id="rtype" className="select" value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })}>
              <option value="yield_summary">Yield summary</option>
              <option value="water_use">Water use</option>
              <option value="input_costs">Input costs</option>
              <option value="field_health">Field health</option>
              <option value="scouting">Scouting packet</option>
            </select>
          </FormField>
          <FormField label="Farm" htmlFor="rfarm">
            <select id="rfarm" className="select" value={form.farm} onChange={(e) => setForm({ ...form, farm: e.target.value })}>
              <option value="">All farms</option>
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Start" htmlFor="rstart">
            <input id="rstart" className="input" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </FormField>
          <FormField label="End" htmlFor="rend">
            <input id="rend" className="input" type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </FormField>
        </div>
        <button type="submit" className="btn btn-primary" disabled={gen.isPending}>
          {gen.isPending ? "Queuing…" : "Generate report"}
        </button>
      </form>
      <div className="card">
        <DataTable
          rows={reportsQ.data?.results ?? []}
          rowKey={(r) => r.id}
          emptyTitle="No generated reports"
          emptyBody="Run a yield summary for North Ridge to populate this list."
          columns={[
            { key: "report_type", header: "Type" },
            { key: "created_at", header: "Created", render: (r) => formatDateTime(r.created_at) },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            {
              key: "file",
              header: "File",
              render: (r) =>
                r.file ? (
                  <a href={r.file} target="_blank" rel="noreferrer">
                    Download
                  </a>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}

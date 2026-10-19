import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmsApi, getApiError, scoutingApi } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";

export default function TreatmentsPage() {
  const qc = useQueryClient();
  const treatQ = useQuery({ queryKey: ["treatments"], queryFn: () => scoutingApi.treatments() });
  const fieldsQ = useQuery({ queryKey: ["fields"], queryFn: () => farmsApi.fields() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    field: "",
    product: "",
    method: "foliar",
    scheduled_date: "",
    notes: "",
    status: "planned",
  });
  const create = useMutation({
    mutationFn: () => scoutingApi.createTreatment({ ...form, field: form.product }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatments"] });
      setOpen(false);
    },
  });

  return (
    <div className="page">
      <PageHeader
        title="Treatments"
        subtitle="Spray plans and follow-up tasks from scouting."
        crumbs={
          <>
            <Link to="/scouting">Scouting</Link>
            <span>/</span>
            <span>Treatments</span>
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            New treatment
          </button>
        }
      />
      <ErrorBanner message={treatQ.error ? getApiError(treatQ.error) : null} />
      <div className="card">
        <DataTable
          rows={treatQ.data?.results ?? []}
          rowKey={(t) => t.id}
          emptyTitle="No treatments"
          emptyBody="After a scout walk, schedule a fungicide or herbicide follow-up."
          columns={[
            { key: "field_name", header: "Field", render: (t) => t.field_name ?? "—" },
            { key: "product", header: "Product" },
            { key: "method", header: "Method" },
            { key: "scheduled_date", header: "Scheduled", render: (t) => formatDate(t.scheduled_date) },
            { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
          ]}
        />
      </div>
      <Drawer open={open} title="Plan treatment" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Field" htmlFor="tfield">
            <select id="tfield" className="select" required value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
              <option value="">Select field</option>
              {(fieldsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Product" htmlFor="tprod">
            <input id="tprod" className="input" required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Headline AMP" />
          </FormField>
          <FormField label="Method" htmlFor="tmethod">
            <input id="tmethod" className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
          </FormField>
          <FormField label="Scheduled date" htmlFor="tdate">
            <input id="tdate" className="input" type="date" required value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          </FormField>
          <FormField label="Notes" htmlFor="tnotes">
            <textarea id="tnotes" className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            Save plan
          </button>
        </form>
      </Drawer>
    </div>
  );
}

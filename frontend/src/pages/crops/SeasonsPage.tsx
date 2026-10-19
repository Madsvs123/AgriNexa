import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cropsApi, getApiError } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";

export default function SeasonsPage() {
  const qc = useQueryClient();
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_active: true });
  const create = useMutation({
    mutationFn: () => cropsApi.createSeason(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seasons"] });
      setOpen(false);
    },
  });

  return (
    <div className="page">
      <PageHeader
        title="Seasons"
        subtitle="Planning windows used by the top-bar season filter."
        crumbs={
          <>
            <Link to="/crops">Crops</Link>
            <span>/</span>
            <span>Seasons</span>
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Add season
          </button>
        }
      />
      <ErrorBanner message={seasonsQ.error ? getApiError(seasonsQ.error) : null} />
      <div className="card">
        <DataTable
          rows={seasonsQ.data?.results ?? []}
          rowKey={(s) => s.id}
          emptyTitle="No seasons"
          emptyBody="Create 2026 and mark it active before planting starts."
          columns={[
            { key: "name", header: "Season" },
            { key: "start_date", header: "Start", render: (s) => formatDate(s.start_date) },
            { key: "end_date", header: "End", render: (s) => formatDate(s.end_date) },
            {
              key: "is_active",
              header: "Status",
              render: (s) => <StatusBadge status={s.is_active ? "idle" : "healthy"} label={s.is_active ? "Closed" : "Active"} />,
            },
          ]}
        />
      </div>
      <Drawer open={open} title="Add season" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="sname">
            <input id="sname" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2026" />
          </FormField>
          <FormField label="Start" htmlFor="sstart">
            <input id="sstart" className="input" type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </FormField>
          <FormField label="End" htmlFor="send">
            <input id="send" className="input" type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </FormField>
          <label className="row">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active season
          </label>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }} disabled={create.isPending}>
            Save
          </button>
        </form>
      </Drawer>
    </div>
  );
}

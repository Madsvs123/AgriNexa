import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cropsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Modal";

export default function VarietiesPage() {
  const qc = useQueryClient();
  const varsQ = useQuery({ queryKey: ["varieties"], queryFn: () => cropsApi.varieties() });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", crop: "", maturity_days: "110", traits: "" });
  const create = useMutation({
    mutationFn: () =>
      cropsApi.createVariety({ ...form, maturity_days: Number(form.maturity_days) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["varieties"] });
      setOpen(false);
    },
  });

  return (
    <div className="page">
      <PageHeader
        title="Varieties"
        subtitle="Hybrids, RM, and trait packages."
        crumbs={
          <>
            <Link to="/crops">Crops</Link>
            <span>/</span>
            <span>Varieties</span>
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Add variety
          </button>
        }
      />
      <ErrorBanner message={varsQ.error ? getApiError(varsQ.error) : null} />
      <div className="card">
        <DataTable
          rows={varsQ.data?.results ?? []}
          rowKey={(v) => v.id}
          emptyTitle="No varieties"
          emptyBody="Add P1197, AG27XF3, or your house wheat variety."
          columns={[
            { key: "name", header: "Variety" },
            { key: "crop_name", header: "Crop", render: (v) => v.crop_name ?? "—" },
            { key: "maturity_days", header: "Maturity days" },
            { key: "traits", header: "Traits" },
          ]}
        />
      </div>
      <Drawer open={open} title="Add variety" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="vname">
            <input id="vname" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Crop" htmlFor="vcrop">
            <select id="vcrop" className="select" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}>
              <option value="">Select crop</option>
              {(cropsQ.data?.results ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Maturity days" htmlFor="vmat">
            <input id="vmat" className="input" type="number" value={form.maturity_days} onChange={(e) => setForm({ ...form, maturity_days: e.target.value })} />
          </FormField>
          <FormField label="Traits" htmlFor="vtraits">
            <input id="vtraits" className="input" value={form.traits} onChange={(e) => setForm({ ...form, traits: e.target.value })} placeholder="VT2P, Enlist, etc." />
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            Save
          </button>
        </form>
      </Drawer>
    </div>
  );
}

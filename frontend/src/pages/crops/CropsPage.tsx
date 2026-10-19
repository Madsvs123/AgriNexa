import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cropsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Modal";

export default function CropsPage() {
  const qc = useQueryClient();
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const plansQ = useQuery({ queryKey: ["crop-plans"], queryFn: () => cropsApi.plans() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "grain", typical_days_to_harvest: "120", water_needs: "medium" });
  const create = useMutation({
    mutationFn: () =>
      cropsApi.createCrop({
        ...form,
        typical_days_to_harvest: Number(form.typical_days_to_harvest),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setOpen(false);
    },
  });

  return (
    <div className="page">
      <PageHeader
        title="Crop catalog"
        subtitle="Species grown across the organization this season."
        actions={
          <>
            <Link to="/crops/plans" className="btn btn-ghost">
              Seasonal plans
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              Add crop
            </button>
          </>
        }
      />
      <ErrorBanner message={cropsQ.error ? getApiError(cropsQ.error) : null} />
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Link to="/crops/varieties" className="card card-pad">
          <h3>Varieties</h3>
          <p className="muted">Hybrids and traits — P1197, AG27XF3, and more.</p>
        </Link>
        <Link to="/crops/rotations" className="card card-pad">
          <h3>Rotations</h3>
          <p className="muted">Corn–soy–wheat sequences by field.</p>
        </Link>
        <Link to="/crops/budget" className="card card-pad">
          <h3>Budget</h3>
          <p className="muted">Planned vs actual seed, chem, and fertilizer.</p>
        </Link>
      </div>
      <div className="card">
        <DataTable
          rows={cropsQ.data?.results ?? []}
          rowKey={(c) => c.id}
          emptyTitle="No crops in the catalog"
          emptyBody="Add corn, soybean, or wheat to start seasonal plans."
          columns={[
            { key: "name", header: "Crop" },
            { key: "category", header: "Category" },
            { key: "typical_days_to_harvest", header: "Days to harvest" },
            { key: "water_needs", header: "Water needs" },
          ]}
        />
      </div>
      <p className="muted" style={{ marginTop: 12 }}>
        {plansQ.data?.count ?? 0} active crop plans this season.
      </p>
      <Drawer open={open} title="Add crop" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="cname">
            <input id="cname" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Category" htmlFor="ccat">
            <select id="ccat" className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="grain">Grain</option>
              <option value="oilseed">Oilseed</option>
              <option value="forage">Forage</option>
              <option value="specialty">Specialty</option>
            </select>
          </FormField>
          <FormField label="Days to harvest" htmlFor="cdays">
            <input
              id="cdays"
              className="input"
              type="number"
              value={form.typical_days_to_harvest}
              onChange={(e) => setForm({ ...form, typical_days_to_harvest: e.target.value })}
            />
          </FormField>
          <FormField label="Water needs" htmlFor="cwater">
            <select id="cwater" className="select" value={form.water_needs} onChange={(e) => setForm({ ...form, water_needs: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            Save crop
          </button>
        </form>
      </Drawer
    </div>
  );
}

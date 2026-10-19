import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiError, tenancyApi } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { Drawer } from "@/components/ui/Modal";
import { ROLE_PERMISSIONS } from "@/types";

export default function RolesPage() {
  const qc = useQueryClient();
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => tenancyApi.roles() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      editing
        ? tenancyApi.patchRole(editing, { name, description, permissions: perms })
        : tenancyApi.createRole({ name, description, permissions: perms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const toggle = (key: string) =>
    setPerms((p) => (p.includes(key) ? [...p, key] : p.filter((x) => x !== key)));

  return (
    <div className="page">
      <PageHeader
        title="Roles"
        subtitle="Permission sets for operators, agronomists, and admins."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setName("");
              setDescription("");
              setPerms([]);
              setOpen(true);
            }}
          >
            New role
          </button>
        }
      />
      <ErrorBanner message={rolesQ.error ? getApiError(rolesQ.error) : null} />
      <div className="stack">
        {(rolesQ.data?.results ?? []).map((r) => (
          <article key={r.id} className="card card-pad">
            <div className="row">
              <h3>{r.name}</h3>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setEditing(r.id);
                  setName(r.name);
                  setDescription(r.description);
                  setPerms(r.permissions ?? []);
                  setOpen(true);
                }}
              >
                Edit
              </button>
            </div>
            <p className="muted">{r.description}</p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {(r.permissions ?? []).map((p) => (
                <span key={p} className="chip">
                  {p}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
      <Drawer open={open} title={editing ? "Edit role" : "New role"} onClose={() => setOpen(false)} wide>
        <FormField label="Name" htmlFor="rname">
          <input id="rname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="rdesc">
          <input id="rdesc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <fieldset>
          <legend className="field-label">Permissions</legend>
          {ROLE_PERMISSIONS.map((p) => (
            <label key={p.key} className="row" style={{ padding: "6px 0" }}>
              <input type="checkbox" checked={perms.includes(p.key)} onChange={() => toggle(p.key)} />
              {p.label} <span className="muted">({p.key})</span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} disabled={save.isPending} onClick={() => save.mutate()}>
          Save role
        </button>
      </Drawer>
    </div>
  );
}

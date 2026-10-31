import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { equipmentApi, farmsApi, getApiError, sensorsApi, cropsApi, tenancyApi } from "@/api/client";
import { formatAcres, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";
import { ConfirmDialog } from "@/components/ui/Modal";
import { MapView } from "@/components/ui/MapView";
import { StatCard } from "@/components/ui/StatCard";

export default function FarmDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const farmQ = useQuery({ queryKey: ["farm", id], queryFn: () => farmsApi.get(id), enabled: !!id });
  const fieldsQ = useQuery({ queryKey: ["fields", { farm: id }], queryFn: () => farmsApi.fields({ farm: id }) });
  const equipQ = useQuery({ queryKey: ["equipment", { farm: id }], queryFn: () => equipmentApi.list({ farm: id }) });
  const sensorsQ = useQuery({ queryKey: ["sensors", { farm: id }], queryFn: () => sensorsApi.list({ farm: id }) });
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const notesQ = useQuery({ queryKey: ["field-notes", { farm: id }], queryFn: () => farmsApi.notes({ farm: id }) });
  const accessQ = useQuery({ queryKey: ["farm-access", id], queryFn: () => tenancyApi.farmAccess(id), enabled: tab === "access" });

  const remove = useMutation({
    mutationFn: () => farmsApi.remove(id),
    onSuccess: () => navigate("/farms"),
  });
  const addNote = useMutation({
    mutationFn: () => farmsApi.createNote({ body: note, field: fieldsQ.data?.results[0]?.id }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["field-notes"] });
    },
  });

  const farm = farmQ.data;
  if (farmQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock rows={8} />
      </div>
    );
  }
  if (!farm) {
    return (
      <div className="page">
        <ErrorBanner message={farmQ.error ? getApiError(farmQ.error) : "Farm not found."} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={farm.name}
        subtitle={`${farm.code} · ${farm.address || "No address"} · ${farm.timezone}`}
        crumbs={
          <>
            <Link to="/farms">Farms</Link>
            <span>/</span>
            <span>{farm.name}</span>
          </>
        }
        actions={
          <>
            <Link to={`/farms/${id}/edit`} className="btn btn-ghost">
              Edit
            </Link>
            <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>
              Archive
            </button>
          </>
        }
      />
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Total acres" value={formatAcres(farm.total_acres)} />
        <StatCard label="Fields" value={fieldsQ.data?.count ?? "—"} />
        <StatCard label="Sensors" value={sensorsQ.data?.count ?? "—"} />
        <StatCard label="Region" value={farm.region?.name ?? "Unassigned"} />
      </div>
      <div className="tabs">
        {["overview", "fields", "equipment", "sensors", "seasons", "notes", "access"].map((t) => (
          <button key={t} type="button" className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <div className="grid grid-2">
          <div className="card" style={{ minHeight: 320 }}>
            <MapView height="320px" fields={fieldsQ.data?.results ?? []} sensors={sensorsQ.data?.results ?? []} />
          </div>
          <div className="card card-pad">
            <h3>Location</h3>
            <p>
              {farm.lat != null && farm.lng != null
                ? `${farm.lat.toFixed(4)}, ${farm.lng.toFixed(4)}`
                : "Drop a pin when you edit this farm."}
            </p>
            <p className="muted">Timezone {farm.timezone}. Use the map to inspect field boundaries.</p>
          </div>
        </div>
      ) : null}
      {tab === "fields" ? (
        <div className="grid grid-3">
          {(fieldsQ.data?.results ?? []).map((f) => (
            <Link key={f.id} to={`/fields/${f.id}`} className="card card-pad">
              <strong>{f.name}</strong>
              <div className="muted">
                {formatAcres(f.acres)} · {f.soil_type || "Soil unknown"}
              </div>
              <div style={{ marginTop: 8 }}>
                <StatusBadge status={f.health_status} />
              </div>
            </Link>
          ))}
          {!fieldsQ.data?.results.length ? (
            <EmptyState title="No fields on this farm" body="Split North 80 or South Bottom into managed fields." />
          ) : null}
        </div>
      ) : null}
      {tab === "equipment" ? (
        <div className="grid grid-3">
          {(equipQ.data?.results ?? []).map((e) => (
            <Link key={e.id} to={`/equipment/${e.id}`} className="card card-pad">
              <strong>{e.name}</strong>
              <div className="muted">
                {e.make} {e.model} · {e.hours} hrs
              </div>
              <StatusBadge status={e.status} />
            </Link>
          ))}
        </div>
      ) : null}
      {tab === "sensors" ? (
        <div className="grid grid-3">
          {(sensorsQ.data?.results ?? []).map((s) => (
            <Link key={s.id} to={`/sensors/${s.id}`} className="card card-pad">
              <strong>{s.name}</strong>
              <div className="muted">{s.sensor_type_name}</div>
              <StatusBadge status={s.status} />
            </Link>
          ))}
        </div>
      ) : null}
      {tab === "seasons" ? (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(seasonsQ.data?.results ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{formatDate(s.start_date)}</td>
                  <td>{formatDate(s.end_date)}</td>
                  <td>{s.is_active ? <StatusBadge status="healthy" label="Active" /> : <StatusBadge status="idle" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "notes" ? (
        <div className="card card-pad">
          <FormField label="Field note" htmlFor="note">
            <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tile outlet running clear on South Bottom…" />
          </FormField>
          <button type="button" className="btn btn-primary" disabled={!note || addNote.isPending} onClick={() => addNote.mutate()}>
            Save note
          </button>
          <div className="stack" style={{ marginTop: 16 }}>
            {(notesQ.data?.results ?? []).map((n) => (
              <div key={n.id}>
                <div className="muted">
                  {n.author_name} · {formatDateTime(n.created_at)}
                </div>
                <div>{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {tab === "access" ? (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>View</th>
                <th>Edit</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {(accessQ.data ?? []).map((a) => (
                <tr key={a.user_id}>
                  <td>{a.user_name || a.user_email}</td>
                  <td>{a.can_view ? "Yes" : "No"}</td>
                  <td>{a.can_edit ? "Yes" : "No"}</td>
                  <td>{a.can_manage ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ padding: 14 }}>
            Update the matrix in Settings → Farm access.
          </p>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="Archive this farm?"
        body="Fields, sensors, and history stay in the database but the farm leaves the active list."
        confirmLabel="Archive farm"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

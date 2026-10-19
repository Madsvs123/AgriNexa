import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmsApi, getApiError, irrigationApi, sensorsApi } from "@/api/client";
import { formatAcres, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard, EmptyState } from "@/components/ui/StatCard";
import { MapView } from "@/components/ui/MapView";

export default function FieldDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const fieldQ = useQuery({ queryKey: ["field", id], queryFn: () => farmsApi.getField(id), enabled: !!id });
  const historyQ = useQuery({ queryKey: ["field-history", id], queryFn: () => farmsApi.fieldHistory(id), enabled: !!id });
  const notesQ = useQuery({ queryKey: ["field-notes", { field: id }], queryFn: () => farmsApi.notes({ field: id }) });
  const zonesQ = useQuery({ queryKey: ["irrigation-zones", { field: id }], queryFn: () => irrigationApi.zones({ field: id }) });
  const sensorsQ = useQuery({ queryKey: ["sensors", { field: id }], queryFn: () => sensorsApi.list({ field: id }) });
  const addNote = useMutation({
    mutationFn: () => farmsApi.createNote({ field: id, body }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["field-notes"] });
    },
  });
  const field = fieldQ.data;

  if (fieldQ.isLoading) {
    return (
      <div className="page">
        <SkeletonBlock rows={8} />
      </div>
    );
  }
  if (!field) {
    return (
      <div className="page">
        <ErrorBanner message={fieldQ.error ? getApiError(fieldQ.error) : "Field not found."} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={field.name}
        subtitle={`${field.farm_name ?? "Farm"} · ${field.soil_type || "Soil unknown"}`}
        crumbs={
          <>
            <Link to="/fields">Fields</Link>
            <span>/</span>
            <span>{field.name}</span>
          </>
        }
        actions={
          <>
            <Link to={`/farms/${field.id}/edit`} className="btn btn-ghost">
              Edit field
            </Link>
            <Link to={`/fields/${field.farm}`} className="btn btn-ghost">
              Open farm
            </Link>
          </>
        }
      />
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Acres" value={formatAcres(field.acres)} />
        <StatCard label="Crop" value={field.crop_name ?? "Fallow"} />
        <StatCard label="Moisture" value={field.moisture != null ? `${field.moisture}%` : "—"} />
        <StatCard label="Health" value={<StatusBadge status={field.health_status} />} />
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card" style={{ minHeight: 280 }}>
          <MapView height="280px" fields={[field]} sensors={sensorsQ.data?.results ?? []} />
        </div>
        <div className="card card-pad">
          <h3>Planting window</h3>
          <p>Planted {formatDate(field.planting_date)}</p>
          <p>Expected harvest {formatDate(field.harvest_date)}</p>
          <p className="muted">Update dates from the crop plan if this field is in a seasonal rotation.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <section className="card card-pad">
          <h3>Crop history</h3>
          {(historyQ.data ?? []).length === 0 ? (
            <EmptyState title="No history yet" body="Prior seasons (corn, soy, wheat) will timeline here." />
          ) : (
            <ol style={{ paddingLeft: 18 }}>
              {(historyQ.data ?? []).map((h) => (
                <li key={h.id} style={{ marginBottom: 10 }}>
                  <strong>{h.crop_name}</strong> · {h.season}
                  <div className="muted">
                    {formatDate(h.planted_at)} → {formatDate(h.harvested_at)} · {h.yield_amount ?? "—"} bu
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card card-pad">
          <h3>Irrigation zones</h3>
          {(zonesQ.data?.results ?? []).map((z) => (
            <Link key={z.id} to={`/irrigation/zones/${z.id}`} className="row" style={{ marginBottom: 8 }}>
              <StatusBadge status={z.status} />
              {z.name} · threshold {z.threshold}%
            </Link>
          ))}
          {!zonesQ.data?.results.length ? <p className="muted">No zones on this field.</p> : null}
          <h3 style={{ marginTop: 18 }}>Sensors</h3>
          {(sensorsQ.data?.results ?? []).map((s) => (
            <Link key={s.id} to={`/sensors/${s.id}`} className="row" style={{ marginBottom: 8 }}>
              <StatusBadge status={s.status} />
              {s.name}
            </Link>
          ))}
        </section>
      </div>
      <section className="card card-pad" style={{ marginTop: 16 }}>
        <h3>Notes</h3>
        <FormField label="Add a note" htmlFor="fnote">
          <textarea id="fnote" className="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Residue heavy on the east headland…" />
        </FormField>
        <button type="button" className="btn btn-primary" disabled={!body || addNote.isPending} onClick={() => addNote.mutate()}>
          Post note
        </button>
        {(notesQ.data?.results ?? []).map((n) => (
          <div key={n.id} style={{ marginTop: 12 }}>
            <div className="muted">
              {n.author_name} · {formatDateTime(n.created_at)}
            </div>
            {n.body}
          </div>
        ))}
      </section>
    </div>
  );
}

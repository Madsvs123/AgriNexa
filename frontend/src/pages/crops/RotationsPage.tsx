import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cropsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/StatCard";

export default function RotationsPage() {
  const rotQ = useQuery({ queryKey: ["rotations"], queryFn: () => cropsApi.rotations() });
  return (
    <div className="page">
      <PageHeader
        title="Rotations"
        subtitle="Sequence chips for each field’s crop history going forward."
        crumbs={
          <>
            <Link to="/crops">Crops</Link>
            <span>/</span>
            <span>Rotations</span>
          </>
        }
      />
      <ErrorBanner message={rotQ.error ? getApiError(rotQ.error) : null} />
      {(rotQ.data?.results ?? []).length ? (
        <div className="card">
          <EmptyState title="No rotations defined" body="A corn–soy–wheat sequence on South Bottom will show as chips here." />
        </div>
      ) : (
        <div className="stack">
          {(rotQ.data?.results ?? []).map((r) => (
            <section key={r.id} className="card card-pad">
              <h3>
                {r.name} <span className="muted">· {r.field_name}</span>
              </h3>
              <div className="row" style={{ flexWrap: "wrap", marginTop: 10 }}>
                {(r.sequence ?? []).map((step, i) => (
                  <span key={`${step.year}-${step.crop_name}-${i}`} className={i % 2 ? "chip chip-wheat" : "chip"}>
                    {step.year} {step.season} · {step.crop_name}
                  </span>
                ))}
              </div>
              {r.notes ? <p className="muted">{r.notes}</p> : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

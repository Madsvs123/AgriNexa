import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { equipmentApi, getApiError } from "@/api/client";
import { formatNumber, formatPct } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";

export default function EquipmentPage() {
  const listQ = useQuery({ queryKey: ["equipment"], queryFn: () => equipmentApi.list() });
  return (
    <div className="page">
      <PageHeader title="Equipment" subtitle="Fleet hours, fuel, and readiness." />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {(listQ.data?.results ?? []).length === 0 ? (
        <div className="card">
          <EmptyState title="No machines yet" body="Add Planter 12, the 8R, or the tender truck to track hours and fuel." />
        </div>
      ) : (
        <div className="grid grid-3">
          {(listQ.data?.results ?? []).map((e) => (
            <Link key={e.id} to={`/equipment/${e.id}`} className="card card-pad">
              <div className="row">
                <strong>{e.name}</strong>
                <span className="spacer" />
                <StatusBadge status={e.status} />
              </div>
              <div className="muted">
                {e.year ?? ""} {e.make} {e.model} · {e.farm_name}
              </div>
              <p>{formatNumber(e.hours)} hours</p>
              <p>Fuel {formatPct(e.fuel_level)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

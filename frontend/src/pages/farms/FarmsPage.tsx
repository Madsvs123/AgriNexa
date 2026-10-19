import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres, formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { MapView } from "@/components/ui/MapView";

export default function FarmsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const farmsQ = useQuery({ queryKey: ["farms", q, region], queryFn: () => farmsApi.list({ search: q || undefined, region: region || undefined }) });
  const regionsQ = useQuery({ queryKey: ["regions"], queryFn: () => farmsApi.regions() });
  const fieldsQ = useQuery({ queryKey: ["fields"], queryFn: () => farmsApi.fields() });
  const farms = farmsQ.data?.results ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Farms"
        subtitle="Every operated unit — codes, acres, and map position."
        actions={
          <Link to="/farms/new" className="btn btn-primary">
            Add farm
          </Link>
        }
      />
      <ErrorBanner message={farmsQ.error ? getApiError(farmsQ.error) : null} />
      <div className="filters">
        <input
          className="input"
          placeholder="Search North Ridge, WR-02…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search farms"
        />
        <select className="select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Filter by region">
          <option value="">All regions</option>
          {(regionsQ.data?.results ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-2">
        <div className="card">
          {farmsQ.isLoading ? (
            <SkeletonBlock />
          ) : (
            <DataTable
              rows={farms}
              rowKey={(f) => f.id}
              onRowClick={(f) => navigate(`/fields/${f.id}`)}
              emptyTitle="No farms yet"
              emptyBody="Create North Ridge or Willow Creek to start mapping fields and sensors."
              emptyAction={
                <Link to="/farms/new" className="btn btn-primary">
                  Add farm
                </Link>
              }
              columns={[
                { key: "name", header: "Farm", render: (f) => <strong>{f.name}</strong> },
                { key: "code", header: "Code" },
                { key: "total_acres", header: "Acres", render: (f) => formatAcres(f.total_acres) },
                { key: "field_count", header: "Fields", render: (f) => formatNumber(f.field_count) },
                { key: "address", header: "Address", render: (f) => f.address || "—" },
              ]}
            />
          )}
        </div>
        <div className="card" style={{ minHeight: 360, overflow: "hidden" }}>
          <MapView
            height="420px"
            fields={fieldsQ.data?.results ?? []}
            center={farms[0]?.lat && farms[0]?.lng ? [farms[0].lng, farms[0].lat] : undefined}
          />
        </div>
      </div>
    </div>
  );
}

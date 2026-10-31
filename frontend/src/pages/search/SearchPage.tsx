import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiError, platformApi } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/StatCard";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const searchQ = useQuery({
    queryKey: ["search-page", q],
    queryFn: () => platformApi.search(q),
    enabled: q.trim().length > 0,
  });
  const data = searchQ.data;
  const groups = useMemo(
    () => [
      { label: "Farms", items: (data?.farms ?? []).map((x) => ({ id: x.id, name: x.name, to: `/farms/${x.id}`, meta: x.code })) },
      { label: "Fields", items: (data?.fields ?? []).map((x) => ({ id: x.id, name: x.name, to: `/fields/${x.id}`, meta: x.farm_name })) },
      {
        label: "Equipment",
        items: (data?.equipment ?? []).map((x) => ({ id: x.id, name: x.name, to: `/equipment/${x.id}`, meta: `${x.make} ${x.model}` })),
      },
      {
        label: "Inventory",
        items: (data?.inventory ?? []).map((x) => ({ id: x.id, name: x.name, to: `/inventory/${x.id}`, meta: x.sku })),
      },
      { label: "Tasks", items: (data?.tasks ?? []).map((x) => ({ id: x.id, name: x.title, to: "/tasks", meta: x.status })) },
    ],
    [data],
  );
  const any = groups.some((g) => g.items.length);

  return (
    <div className="page">
      <PageHeader title="Search" subtitle="Farms, fields, equipment, inventory, and tasks." />
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <input
          className="input"
          style={{ minWidth: 280 }}
          value={q}
          onChange={(e) => setParams({ q: e.target.value })}
          placeholder="North Ridge, Planter 12, MAP 11-52-0…"
          aria-label="Search"
        />
      </form>
      <ErrorBanner message={searchQ.error ? getApiError(searchQ.error) : null} />
      {!q ? (
        <div className="card">
          <EmptyState title="Start typing" body="Search by farm code, field nickname, SKU, or machine name." />
        </div>
      ) : !any && searchQ.isFetched ? (
        <div className="card">
          <EmptyState title={`No matches for “${q}”`} body="Try a shorter token or a farm code like WR-02." />
        </div>
      ) : (
        groups.map((g) =>
          g.items.length ? (
            <section key={g.label} className="card card-pad" style={{ marginBottom: 12 }}>
              <h3>{g.label}</h3>
              {g.items.map((item) => (
                <Link key={item.id} to={item.to} className="row" style={{ padding: "8px 0" }}>
                  <strong>{item.name}</strong>
                  <span className="muted">{item.meta}</span>
                </Link>
              ))}
            </section>
          ) : null,
        )
      )}
    </div>
  );
}

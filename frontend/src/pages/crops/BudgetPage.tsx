import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cropsApi, getApiError } from "@/api/client";
import { formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { ChartCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";

export default function BudgetPage() {
  const budgetQ = useQuery({ queryKey: ["budgets"], queryFn: () => cropsApi.budgets() });
  const rows = budgetQ.data?.results ?? [];
  const chart = rows.map((r) => ({ category: r.category, planned: r.planned, actual: r.actual }));
  return (
    <div className="page">
      <PageHeader
        title="Seasonal budget"
        subtitle="Planned versus actual spend by input category."
        crumbs={
          <>
            <Link to="/crops">Crops</Link>
            <span>/</span>
            <span>Budget</span>
          </>
        }
      />
      <ErrorBanner message={budgetQ.error ? getApiError(budgetQ.error) : null} />
      <ChartCard title="Planned vs actual">
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="actual" fill="#2F6F4E" />
              <Bar dataKey="planned" fill="#D4A017" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <div className="card" style={{ marginTop: 16 }}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No budget lines"
          emptyBody="Add seed, fertilizer, chemical, and custom hire lines for this season."
          columns={[
            { key: "category", header: "Category" },
            { key: "season_name", header: "Season", render: (r) => r.season_name ?? "—" },
            { key: "planned", header: "Planned", render: (r) => `$${formatNumber(r.planned, 0)}` },
            { key: "actual", header: "Actual", render: (r) => `$${formatNumber(r.actual, 0)}` },
            { key: "notes", header: "Notes" },
          ]}
        />
      </div>
    </div>
  );
}

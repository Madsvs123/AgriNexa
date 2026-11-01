import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Box } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { ListPage } from "@/components/templates/ListPage";
import { ChartCard } from "@/components/ui/StatCard";
import { ChartFrame } from "@/components/ui/ChartFrame";
import { DataTable } from "@/components/ui/DataTable";
import { useScope } from "@/hooks/useScope";
import { formatCurrency } from "@/i18n/format";


export default function BudgetPage() {
  const { params } = useScope();
  const budgetQ = useQuery({
    queryKey: ["budgets", params],
    queryFn: () =>
      cropsApi.budgets({
        ...(params.farm ? { farm: params.farm } : {}),
        ...(params.season_id ? { season: params.season_id } : {}),
      }),
  });
  const rows = budgetQ.data?.results ?? [];
  const byCategory = new Map<string, { category: string; planned: number; actual: number }>();
  for (const r of rows) {
    const cur = byCategory.get(r.category) ?? { category: r.category, planned: 0, actual: 0 };
    cur.planned += Number(r.planned_amount);
    cur.actual += Number(r.actual_amount);
    byCategory.set(r.category, cur);
  }
  const chart = [...byCategory.values()];

  return (
    <ListPage
      title="Seasonal budget"
      subtitle="Planned versus actual spend by input category."
      error={budgetQ.error ? getApiError(budgetQ.error) : null}
      loading={budgetQ.isLoading}
      stats={
        <ChartCard title="Planned vs actual">
          <ChartFrame height="260px">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="actual" fill="#2F6F4E" name="Actual" />
              <Bar dataKey="planned" fill="#D4A017" name="Planned" />
            </BarChart>
            </ChartFrame>
        </ChartCard>
      }
    >
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="No budget lines"
        emptyBody="Add seed, fertilizer, chemical, and custom hire lines for this season."
        columns={[
          { key: "category", header: "Category", render: (r) => r.category[0].toUpperCase() + r.category.slice(1) },
          { key: "farm_name", header: "Farm", render: (r) => r.farm_name ?? "—" },
          { key: "season_name", header: "Season", render: (r) => r.season_name ?? "—" },
          { key: "planned", header: "Planned", render: (r) => formatCurrency(r.planned_amount) },
          { key: "actual", header: "Actual", render: (r) => formatCurrency(r.actual_amount) },
          {
            key: "variance",
            header: "Variance",
            render: (r) => {
              const v = Number(r.actual_amount) - Number(r.planned_amount);
              return <Box as="span" color={v > 0 ? "red.500" : "green.600"}>{v > 0 ? "+" : ""}{formatCurrency(v)}</Box>;
            },
          },
        ]}
      />
    </ListPage>
  );
}

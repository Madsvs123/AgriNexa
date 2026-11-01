import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";
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
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();
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
      title={t("budget.title")}
      subtitle={t("budget.subtitle")}
      error={budgetQ.error ? getApiError(budgetQ.error) : null}
      loading={budgetQ.isLoading}
      stats={
        <ChartCard title={t("budget.plannedVsActual")}>
          <ChartFrame height="260px">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="actual" fill="#2F6F4E" name={t("budget.actual")} />
              <Bar dataKey="planned" fill="#D4A017" name={t("budget.planned")} />
            </BarChart>
            </ChartFrame>
        </ChartCard>
      }
    >
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle={t("budget.emptyTitle")}
        emptyBody={t("budget.emptyBody")}
        columns={[
          { key: "category", header: t("budget.columns.category"), render: (r) => labels.budgetCategory(r.category) },
          { key: "farm_name", header: t("budget.columns.farm"), render: (r) => r.farm_name ?? "—" },
          { key: "season_name", header: t("budget.columns.season"), render: (r) => r.season_name ?? "—" },
          { key: "planned", header: t("budget.columns.planned"), render: (r) => formatCurrency(r.planned_amount) },
          { key: "actual", header: t("budget.columns.actual"), render: (r) => formatCurrency(r.actual_amount) },
          {
            key: "variance",
            header: t("budget.columns.variance"),
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

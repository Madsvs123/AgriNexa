import { SimpleGrid } from "@chakra-ui/react";
import type { StrategyTotals } from "@/types";
import { StatCard } from "@/components/ui/StatCard";

import { formatNumber } from "@/lib/utils";
import { formatCurrency } from "@/i18n/format";
import { useTranslation } from "react-i18next";

/** The headline economics and resource numbers for a strategy or season. */
export function MetricGrid({
  totals,
  columns = { base: 2, md: 4 },
  extra,
}: {
  totals: StrategyTotals;
  columns?: Record<string, number> | number;
  extra?: React.ReactNode[];
}) {
  const { t } = useTranslation("grow");
  return (
    <SimpleGrid columns={columns} spacing={3}>
      <StatCard label={t("metrics.revenue")} value={formatCurrency(totals.revenue)} />
      <StatCard label={t("metrics.totalCost")} value={formatCurrency(totals.total_cost)} hint={t("metrics.seedInputs", { seed: formatCurrency(totals.seed_cost), inputs: formatCurrency(totals.input_cost) })} />
      <StatCard label={t("metrics.netMargin")} value={formatCurrency(totals.margin)} hint={t("detail.perAcre", { value: formatCurrency(totals.margin_per_acre) })} />
      <StatCard label={t("metrics.acres")} value={formatNumber(totals.acres, 0)} />
      <StatCard label={t("metrics.labor")} value={`${formatNumber(totals.labor_hours, 0)} h`} />
      <StatCard label={t("metrics.water")} value={`${formatNumber(totals.water_acre_inches, 0)} ac-in`} />
      <StatCard
        label={t("metrics.nitrogenBalance")}
        value={`${totals.nitrogen_balance_lb >= 0 ? "+" : ""}${formatNumber(totals.nitrogen_balance_lb, 0)} lb`}
        hint={t("metrics.nitrogenHint", { demand: formatNumber(totals.nitrogen_demand_lb, 0), fixed: formatNumber(totals.nitrogen_fixed_lb, 0) })}
      />
      {extra}
    </SimpleGrid>
  );
}

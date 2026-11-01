import { SimpleGrid } from "@chakra-ui/react";
import type { StrategyTotals } from "@/types";
import { StatCard } from "@/components/ui/StatCard";

import { formatNumber } from "@/lib/utils";
import { formatCurrency } from "@/i18n/format";

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
  return (
    <SimpleGrid columns={columns} spacing={3}>
      <StatCard label="Revenue" value={formatCurrency(totals.revenue)} />
      <StatCard label="Total cost" value={formatCurrency(totals.total_cost)} hint={`Seed ${formatCurrency(totals.seed_cost)} · inputs ${formatCurrency(totals.input_cost)}`} />
      <StatCard label="Net margin" value={formatCurrency(totals.margin)} hint={`${formatCurrency(totals.margin_per_acre)} / acre`} />
      <StatCard label="Acres" value={formatNumber(totals.acres, 0)} />
      <StatCard label="Labor" value={`${formatNumber(totals.labor_hours, 0)} h`} />
      <StatCard label="Water" value={`${formatNumber(totals.water_acre_inches, 0)} ac-in`} />
      <StatCard
        label="N balance"
        value={`${totals.nitrogen_balance_lb >= 0 ? "+" : ""}${formatNumber(totals.nitrogen_balance_lb, 0)} lb`}
        hint={`Demand ${formatNumber(totals.nitrogen_demand_lb, 0)} · fixed ${formatNumber(totals.nitrogen_fixed_lb, 0)}`}
      />
      {extra}
    </SimpleGrid>
  );
}

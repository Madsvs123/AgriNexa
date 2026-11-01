import { Badge, Box, Flex, Progress, Stack, Text } from "@chakra-ui/react";
import type { ConstraintResult } from "@/types";
import { useTranslation } from "react-i18next";
import { constraintScheme } from "@/lib/planning";
import { usePlanningLabels } from "@/lib/usePlanningLabels";
import { formatCurrency } from "@/i18n/format";

function fmt(value: number, unit: string) {
  if (unit === "USD") return formatCurrency(value);
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit ? ` ${unit}` : ""}`;
}

/** Utilisation bars for resource constraints, worst first. */
export function ConstraintBars({ results, compact }: { results: ConstraintResult[]; compact?: boolean }) {
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();

  if (!results.length) {
    return (
      <Text color="fg.muted" fontSize="sm">
        {t("constraints.noneApply")}
      </Text>
    );
  }
  const order = { violated: 0, exceeded: 1, tight: 2, ok: 3 };
  const sorted = [...results].sort((a, b) => order[a.status] - order[b.status] || b.utilization_pct - a.utilization_pct);
  return (
    <Stack spacing={compact ? 2 : 3}>
      {sorted.map((c) => {
        const scheme = constraintScheme(c.status);
        return (
          <Box key={c.constraint_id}>
            <Flex align="center" gap={2} mb={1}>
              <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                {labels.resource(c.resource)}
              </Text>
              <Badge colorScheme={scheme} variant="subtle" fontSize="10px">
                {labels.constraintStatus(c.status)}
              </Badge>
              {!c.is_hard ? (
                <Badge variant="outline" colorScheme="gray" fontSize="10px">
                  {t("constraints.soft")}
                </Badge>
              ) : null}
              <Box flex="1" />
              <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                {fmt(c.used, c.unit)} / {fmt(c.limit, c.unit)} · {c.utilization_pct.toFixed(0)}%
              </Text>
            </Flex>
            <Progress
              value={Math.min(100, c.utilization_pct)}
              size={compact ? "xs" : "sm"}
              colorScheme={scheme}
              borderRadius="full"
              bg="bg.subtle"
            />
          </Box>
        );
      })}
    </Stack>
  );
}

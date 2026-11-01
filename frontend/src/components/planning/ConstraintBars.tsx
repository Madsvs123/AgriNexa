import { Badge, Box, Flex, Progress, Stack, Text } from "@chakra-ui/react";
import type { ConstraintResult } from "@/types";
import { constraintScheme, fmtMoney } from "@/lib/planning";

function fmt(value: number, unit: string) {
  if (unit === "USD") return fmtMoney(value);
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit ? ` ${unit}` : ""}`;
}

/** Utilisation bars for resource constraints, worst first. */
export function ConstraintBars({ results, compact }: { results: ConstraintResult[]; compact?: boolean }) {
  if (!results.length) {
    return (
      <Text color="fg.muted" fontSize="sm">
        No resource constraints apply to this farm and season.
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
                {c.label}
              </Text>
              <Badge colorScheme={scheme} variant="subtle" textTransform="capitalize" fontSize="10px">
                {c.status}
              </Badge>
              {!c.is_hard ? (
                <Badge variant="outline" colorScheme="gray" fontSize="10px">
                  soft
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
